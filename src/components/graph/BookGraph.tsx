"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ForceGraphMethods } from "react-force-graph-2d";
import { forceCollide, forceX, forceY } from "d3-force";
import { Book, GraphData, GraphLink, GraphNode } from "@/lib/types";
import { nodeRadius } from "@/lib/buildGraph";
import EdgeTooltip from "./EdgeTooltip";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface Props {
  data: GraphData;
  focusedNodeId?: string | null;
  showLabels: boolean;
  onBookClick: (book: Book) => void;
  onBackgroundClick: () => void;
}

const DIM_OPACITY = 0.08;

// Padding so the constellation fills ~65% of the smaller viewport dimension
function getFitPadding(): number {
  if (typeof window === "undefined") return 100;
  return Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.15);
}

// Only fit to nodes that have edges — background stars inflate the bounding box
const connectedFilter = (n: object) => (n as GraphNode).val > 0;

// Decorative background starfield — deterministic, rendered in graph-space so they parallax with pan
const BG_STARS = (() => {
  const stars: { x: number; y: number; r: number; baseOpacity: number; phase: number }[] = [];
  let seed = 42;
  const rand = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) | 0;
    return (seed >>> 0) / 0xffffffff;
  };
  for (let i = 0; i < 1400; i++) {
    const bright = rand() < 0.05;
    stars.push({
      x: (rand() - 0.5) * 5000,
      y: (rand() - 0.5) * 5000,
      r: bright ? 1.2 + rand() * 0.8 : 0.3 + rand() * 0.7,
      baseOpacity: bright ? 0.35 + rand() * 0.3 : 0.06 + rand() * 0.14,
      phase: rand() * Math.PI * 2,
    });
  }
  return stars;
})();

function traceStar(ctx: CanvasRenderingContext2D, x: number, y: number, outerR: number) {
  const innerR = outerR * 0.42;
  const points = 5;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    if (i === 0) ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    else ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
  }
  ctx.closePath();
}

// Deterministic phase offset per node for desynchronized twinkle
function nodePhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return ((h >>> 0) / 4294967295) * Math.PI * 2;
}

// Deterministic background star appearance — size and opacity vary per node
function starProps(id: string): { r: number; opacity: number } {
  let h1 = 0, h2 = 0;
  for (let i = 0; i < id.length; i++) {
    h1 = (Math.imul(31, h1) + id.charCodeAt(i)) | 0;
    h2 = (Math.imul(37, h2) + id.charCodeAt(i)) | 0;
  }
  const t1 = (h1 >>> 0) / 4294967295;
  const t2 = (h2 >>> 0) / 4294967295;
  if (t1 < 0.067) return { r: 7, opacity: 0.6 };           // bright star (~1 in 15)
  return { r: 2 + t1 * 4, opacity: 0.18 + t2 * 0.38 };   // 2–6px, 0.18–0.56 opacity
}

function traceDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  // Control point at center pulls all four edges inward → 4-pointed star (✦ shape)
  ctx.beginPath();
  ctx.moveTo(x,     y - r);
  ctx.quadraticCurveTo(x, y, x + r, y    );
  ctx.quadraticCurveTo(x, y, x,     y + r);
  ctx.quadraticCurveTo(x, y, x - r, y    );
  ctx.quadraticCurveTo(x, y, x,     y - r);
  ctx.closePath();
}
const BRIGHT_LINK_OPACITY   = 0.90;
const DEFAULT_LINK_COLOR    = "rgba(180,215,255,0.12)";
const DEFAULT_LINK_COLOR_DIM = `rgba(148,163,184,${DIM_OPACITY})`;

export default function BookGraph({ data, focusedNodeId, showLabels, onBookClick, onBackgroundClick }: Props) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [edgeTooltip, setEdgeTooltip] = useState<{ link: GraphLink; x: number; y: number } | null>(null);
  const wasFocusedRef = useRef(false);
  const hasInitialFitRef = useRef(false);
  const [introOpaque, setIntroOpaque] = useState(true);
  const [minZoomLevel, setMinZoomLevel] = useState(0.01);

  // Log all unique subjects so we can verify color coverage
  useEffect(() => {
    if (data.nodes.length === 0) return;
    const unique = [...new Set(data.nodes.flatMap((n) => n.book.subjects))].sort();
    console.log(`[BookGraph] unique subjects (${unique.length}):`, unique);
  }, [data.nodes]);

  // Nodes that participate in at least one edge — the "constellation"
  const allConnectedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const link of data.links) {
      const src = typeof link.source === "object" ? (link.source as GraphNode).id : link.source as string;
      const tgt = typeof link.target === "object" ? (link.target as GraphNode).id : link.target as string;
      ids.add(src);
      ids.add(tgt);
    }
    return ids;
  }, [data.links]);

  // Connected components (for nebula glows) via union-find
  const clusterGroups = useMemo(() => {
    const parent = new Map<string, string>();
    const root = (id: string): string => {
      if (!parent.has(id)) parent.set(id, id);
      if (parent.get(id) !== id) parent.set(id, root(parent.get(id)!));
      return parent.get(id)!;
    };
    for (const link of data.links) {
      const s = typeof link.source === "object" ? (link.source as GraphNode).id : link.source as string;
      const t = typeof link.target === "object" ? (link.target as GraphNode).id : link.target as string;
      parent.set(root(s), root(t));
    }
    const groups = new Map<string, string[]>();
    for (const id of allConnectedIds) {
      const r = root(id);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r)!.push(id);
    }
    return [...groups.values()];
  }, [data.links, allConnectedIds]);

  // Active highlight = hover takes priority over focused
  const activeId = hoveredNodeId ?? focusedNodeId ?? null;

  const connectedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeId) { connectedIds.current = new Set(); return; }
    const ids = new Set<string>([activeId]);
    for (const link of data.links) {
      const src = typeof link.source === "object" ? (link.source as GraphNode).id : link.source;
      const tgt = typeof link.target === "object" ? (link.target as GraphNode).id : link.target;
      if (src === activeId) ids.add(tgt);
      if (tgt === activeId) ids.add(src);
    }
    connectedIds.current = ids;
  }, [activeId, data.links]);

  // Configure force simulation for spacing — re-run when graph size changes
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (!fgRef.current) return;
      fgRef.current.d3Force("charge")?.strength(-840);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fgRef.current.d3Force("link") as any)?.distance(50)?.strength(0.8);
      fgRef.current.d3Force(
        "collision",
        forceCollide((node) => {
          const n = node as GraphNode;
          return nodeRadius(n.val, n.book.rating) + 6;
        })
      );
      // Gentle gravity — keeps background stars from drifting too far from the constellation
      fgRef.current.d3Force("x", forceX(0).strength(0.04));
      fgRef.current.d3Force("y", forceY(0).strength(0.04));
      fgRef.current.d3ReheatSimulation();
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.nodes.length]);

  // Pan + zoom to focused node; zoom back out when deselected
  useEffect(() => {
    if (!fgRef.current) return;
    if (!focusedNodeId) {
      if (wasFocusedRef.current) fgRef.current.zoomToFit(600, getFitPadding(), connectedFilter);
      wasFocusedRef.current = false;
      return;
    }
    const node = data.nodes.find((n) => n.id === focusedNodeId);
    if (!node || node.x == null || node.y == null) return;
    wasFocusedRef.current = true;
    fgRef.current.centerAt(node.x, node.y, 600);
    fgRef.current.zoom(4, 600);
  }, [focusedNodeId, data.nodes]);

  const handleEngineStop = useCallback(() => {
    fgRef.current?.resumeAnimation();
    if (hasInitialFitRef.current) return;
    hasInitialFitRef.current = true;

    // Compute fit at target padding, step back to 80%, then drift in
    const pad = getFitPadding();
    fgRef.current?.zoomToFit(0, pad, connectedFilter);
    const fitted = fgRef.current?.zoom() ?? 1;
    fgRef.current?.zoom(fitted * 0.8, 0);

    requestAnimationFrame(() => {
      fgRef.current?.zoomToFit(1500, pad, connectedFilter);
      setIntroOpaque(false);
      setTimeout(() => setMinZoomLevel(0.08), 1700);
    });
  }, []);

  // Decorative starfield + nebula glows — drawn before nodes/links
  const onRenderFramePre = useCallback((ctx: CanvasRenderingContext2D) => {
    // Background starfield (graph-space parallax)
    const t = Date.now() / 3500;
    ctx.save();
    for (let i = 0; i < BG_STARS.length; i++) {
      const { x, y, r, baseOpacity, phase } = BG_STARS[i];
      const twinkle = (Math.sin(t + phase) + 1) / 2;
      ctx.globalAlpha = baseOpacity * (0.6 + 0.4 * twinkle);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = "#c8d8f0";
      ctx.fill();
    }
    ctx.restore();

    // Nebula glows
    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
    ctx.save();
    for (const clusterIds of clusterGroups) {
      if (clusterIds.length < 3) continue; // skip tiny clusters
      const nodes = clusterIds
        .map((id) => nodeMap.get(id))
        .filter((n): n is GraphNode => n != null && n.x != null && n.y != null);
      if (nodes.length < 3) continue;

      const cx = nodes.reduce((s, n) => s + n.x!, 0) / nodes.length;
      const cy = nodes.reduce((s, n) => s + n.y!, 0) / nodes.length;
      const maxDist = Math.max(...nodes.map((n) => Math.hypot(n.x! - cx, n.y! - cy)));
      if (maxDist < 5) continue;

      const nebulaR = maxDist * 2.0 + 52;
      const dominant = nodes.reduce((a, b) => (b.val > a.val ? b : a));

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, nebulaR);
      grad.addColorStop(0,   `${dominant.color}1e`); // ~12%
      grad.addColorStop(0.4, `${dominant.color}12`); // ~7%
      grad.addColorStop(1,   `${dominant.color}00`);

      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, nebulaR, 0, 2 * Math.PI);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  }, [clusterGroups, data.nodes]);

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const radius = nodeRadius(n.val, n.book.rating);

      const isActive = activeId === n.id;
      const isFocused = focusedNodeId === n.id;
      const isDimmed = activeId !== null && !connectedIds.current.has(n.id);

      // Background stars: unconnected nodes drawn as simple varied-brightness dots
      if (!allConnectedIds.has(n.id)) {
        const { r: starR, opacity: starOpacity } = starProps(n.id);
        ctx.globalAlpha = isDimmed ? DIM_OPACITY : starOpacity;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(x, y, starR, 0, 2 * Math.PI);
        ctx.fillStyle = "#c8d8f0";
        ctx.fill();
        ctx.globalAlpha = 1;
        return;
      }

      ctx.globalAlpha = isDimmed ? DIM_OPACITY : 1;

      // Twinkle: connected nodes breathe between 0.85–1.0 opacity, each at its own pace
      if (!isDimmed && allConnectedIds.has(n.id)) {
        const t = (Math.sin(Date.now() / 3500 + nodePhase(n.id)) + 1) / 2;
        ctx.globalAlpha = 0.85 + 0.15 * t;
      }

      // Soft radial halo for books with a review
      if (n.book.review) {
        const glowR = radius * 3.5;
        const gradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, glowR);
        gradient.addColorStop(0, `${n.color}40`);
        gradient.addColorStop(1, `${n.color}00`);
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      ctx.shadowColor = n.color;

      const rating = n.book.rating ?? 0;
      const isStar    = rating === 5;
      const isDiamond = rating === 4;

      if (isStar) {
        // Double-pass glow for 5★
        ctx.shadowBlur = isActive ? 32 : 22;
        traceStar(ctx, x, y, radius);
        ctx.fillStyle = n.color;
        ctx.fill();
        ctx.shadowBlur = isActive ? 14 : 8;
        traceStar(ctx, x, y, radius);
        ctx.fill();
      } else if (isDiamond) {
        // Single-pass glow for 4★ diamond
        ctx.shadowBlur = isActive ? 20 : isFocused ? 14 : 8;
        traceDiamond(ctx, x, y, radius);
        ctx.fillStyle = n.color;
        ctx.fill();
      } else {
        // Circle for 3★ and below
        ctx.shadowBlur = isActive ? 22 : isFocused ? 16 : 3;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = n.color;
        ctx.fill();
      }

      // Extra ring on focused node
      if (isFocused && !hoveredNodeId) {
        if (isStar)         traceStar(ctx, x, y, radius);
        else if (isDiamond) traceDiamond(ctx, x, y, radius);
        else                { ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); }
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // showLabels=true → always show for connected nodes; false → only on hover or deep zoom
      const showLabel = isActive || (n.val > 0 && (showLabels || globalScale > 2));
      if (showLabel) {
        const fontSize = Math.max(12 / globalScale, 10);
        const cutoff = Math.min(
          n.title.includes(":") ? n.title.indexOf(":") : Infinity,
          n.title.includes("(") ? n.title.indexOf("(") : Infinity,
        );
        const label = cutoff < Infinity ? n.title.slice(0, cutoff).trimEnd() : n.title;
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(7,7,20,0.9)";
        ctx.shadowBlur = 4;
        ctx.fillStyle = isDimmed ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.82)";
        ctx.fillText(label, x, y + radius + fontSize * 0.7 + 3);
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;
    },
    [activeId, focusedNodeId, hoveredNodeId, showLabels, allConnectedIds]
  );

  const linkColor = useCallback(
    (link: object) => {
      const l = link as GraphLink;
      const src = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
      const tgt = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
      if (!activeId) return DEFAULT_LINK_COLOR;
      const isConnected = src === activeId || tgt === activeId;
      return isConnected
        ? `rgba(167,139,250,${BRIGHT_LINK_OPACITY})`
        : DEFAULT_LINK_COLOR_DIM;
    },
    [activeId]
  );

  const handleNodeClick = useCallback(
    (node: object) => {
      onBookClick((node as GraphNode).book);
      setEdgeTooltip(null);
    },
    [onBookClick]
  );

  const handleNodeHover = useCallback((node: object | null) => {
    setHoveredNodeId(node ? (node as GraphNode).id : null);
    document.body.style.cursor = node ? "pointer" : "default";
  }, []);

  const handleLinkClick = useCallback((link: object, event: MouseEvent) => {
    setEdgeTooltip({ link: link as GraphLink, x: event.clientX, y: event.clientY });
  }, []);

  const handleBgClick = useCallback(() => {
    setEdgeTooltip(null);
    onBackgroundClick();
  }, [onBackgroundClick]);

  const handleZoomEnd = useCallback(({ k }: { k: number; x: number; y: number }) => {
    // After intro, snap back to fit if user zooms out past the min
    if (hasInitialFitRef.current && k <= minZoomLevel + 0.01) {
      fgRef.current?.zoomToFit(600, getFitPadding(), connectedFilter);
    }
  }, [minZoomLevel]);

  return (
    <div className="relative w-full h-full">
      {/* Intro overlay — fades out to reveal the constellation */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 5,
          background: "#0a0a14",
          opacity: introOpaque ? 1 : 0,
          transition: introOpaque ? "none" : "opacity 1.5s ease-out",
        }}
      />
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeId="id"
        nodeVal="val"
        nodeColor="color"
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => "replace"}
        linkColor={linkColor}
        linkWidth={(link) => Math.sqrt((link as GraphLink).weight) * 1.2 + 1.0}
        linkCurvature={(link) => {
          const l = link as GraphLink;
          const src = typeof l.source === "object" ? l.source as GraphNode : null;
          const tgt = typeof l.target === "object" ? l.target as GraphNode : null;
          if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) return 0;
          const dist = Math.hypot(tgt.x - src.x, tgt.y - src.y);
          return Math.min(0.12, dist / 1200);
        }}
        backgroundColor="transparent"
        onRenderFramePre={onRenderFramePre}
        onEngineStop={handleEngineStop}
        onZoomEnd={handleZoomEnd}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onLinkClick={handleLinkClick}
        onBackgroundClick={handleBgClick}
        minZoom={minZoomLevel}
        maxZoom={12}
        cooldownTicks={120}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.3}
      />
      <EdgeTooltip
        link={edgeTooltip?.link ?? null}
        x={edgeTooltip?.x ?? 0}
        y={edgeTooltip?.y ?? 0}
      />
    </div>
  );
}
