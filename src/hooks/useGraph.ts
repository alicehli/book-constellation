"use client";

import { useEffect, useMemo, useState } from "react";
import { Book, GraphData } from "@/lib/types";
import { analyzeBooks, buildEdges, deduplicateBooks, AnalyzerEdge } from "@/lib/analyzer";
import { buildGraph } from "@/lib/buildGraph";

interface GraphState {
  graphData: GraphData;
  edges: AnalyzerEdge[];
  /** The books array these results were computed from */
  source: Book[] | null;
}

const EMPTY: GraphState = { graphData: { nodes: [], links: [] }, edges: [], source: null };

export function useGraph(
  books: Book[],
  precomputedEdges?: AnalyzerEdge[]
): { graphData: GraphData; analyzing: boolean; edges: AnalyzerEdge[] } {
  const [state, setState] = useState<GraphState>(EMPTY);
  const hasPrecomputed = !!precomputedEdges && precomputedEdges.length > 0;

  useEffect(() => {
    // Read-only mode ships pre-baked edges, and an empty library needs no analysis
    if (books.length === 0 || hasPrecomputed) return;

    let cancelled = false;
    analyzeBooks(books).then(async (themes) => {
      const computed = await buildEdges(themes);
      if (cancelled) return;
      setState({ graphData: buildGraph(deduplicateBooks(books), computed), edges: computed, source: books });
    });
    return () => { cancelled = true; };
  }, [books, hasPrecomputed]);

  const precomputedGraph = useMemo(
    () => (hasPrecomputed ? buildGraph(deduplicateBooks(books), precomputedEdges!) : null),
    [books, precomputedEdges, hasPrecomputed]
  );

  if (books.length === 0) return { graphData: EMPTY.graphData, analyzing: false, edges: [] };
  if (precomputedGraph) return { graphData: precomputedGraph, analyzing: false, edges: precomputedEdges! };
  // Keep showing the previous graph while a re-analysis is in flight
  return { graphData: state.graphData, analyzing: state.source !== books, edges: state.edges };
}
