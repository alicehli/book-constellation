"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BookGraph from "./BookGraph";
import BookSidebar, { type SimilarBook } from "./BookSidebar";
import GraphLegend from "./GraphLegend";
import SearchBar from "./SearchBar";
import { useBooks } from "@/hooks/useBooks";
import { useGraph } from "@/hooks/useGraph";
import type { AnalyzerEdge } from "@/lib/analyzer";
import { Book, GraphLink, GraphNode } from "@/lib/types";

const linkEndId = (end: GraphLink["source"]) =>
  typeof end === "object" ? (end as GraphNode).id : end;

function downloadLibrary(books: Book[], edges: AnalyzerEdge[]) {
  const blob = new Blob([JSON.stringify({ books, edges }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "alice-library.json";
  a.click();
  // Revoking synchronously can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const HUD_BUTTON =
  "px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/8 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-colors";

export default function GraphView() {
  const router = useRouter();
  const { books, precomputedEdges, clearLibrary, hydrated, readOnly } = useBooks();

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);

  const { graphData, analyzing, edges } = useGraph(books, precomputedEdges);

  // De-duplicated books actually on the graph (search shouldn't list duplicates)
  const graphBooks = useMemo(() => graphData.nodes.map((n) => n.book), [graphData.nodes]);

  const connections = useMemo((): SimilarBook[] => {
    if (!selectedBook) return [];
    const bookMap = new Map(graphData.nodes.map((n) => [n.id, n.book]));
    return graphData.links
      .flatMap((l) => {
        const src = linkEndId(l.source);
        const tgt = linkEndId(l.target);
        if (src === selectedBook.id) return [{ id: tgt, l }];
        if (tgt === selectedBook.id) return [{ id: src, l }];
        return [];
      })
      .map(({ id, l }) => {
        const other = bookMap.get(id);
        return other ? { book: other, strength: l.strength, weight: l.weight, themes: l.sharedSubjects } : null;
      })
      .filter((x) => x !== null)
      .sort((a, b) => b.weight - a.weight || b.themes.length - a.themes.length);
  }, [selectedBook, graphData]);

  const handleBookClick = useCallback((book: Book) => {
    if (book.id === focusedNodeId) {
      setSelectedBook(null);
      setFocusedNodeId(null);
    } else {
      setSelectedBook(book);
      setFocusedNodeId(book.id);
    }
  }, [focusedNodeId]);

  // Search always selects (never toggles off) the chosen book
  const handleSearchSelect = useCallback((book: Book) => {
    setSelectedBook(book);
    setFocusedNodeId(book.id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBook(null);
    setFocusedNodeId(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) clearSelection();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#070714] flex items-center justify-center">
        <div className="text-white/30 text-sm">Loading…</div>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="min-h-screen bg-[#070714] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white/40 text-sm">No books in your library yet.</p>
          {!readOnly && (
            <button
              onClick={() => router.push("/")}
              className="text-violet-400 hover:text-violet-300 text-sm underline underline-offset-2"
            >
              Import some books
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ background: "radial-gradient(ellipse 150% 150% at 50% 50%, #141428 0%, #0d0d1e 45%, #0a0a14 100%)" }}
    >
      {/* Milky way — diagonal band of very faint nebular haze */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: "linear-gradient(125deg, transparent 18%, rgba(180,180,240,0.000) 28%, rgba(190,190,255,0.032) 42%, rgba(200,200,255,0.044) 50%, rgba(190,190,255,0.032) 58%, rgba(180,180,240,0.000) 72%, transparent 82%)",
        }}
      />
      {/* Ambient violet glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(109,40,217,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Graph canvas */}
      <div className="absolute inset-0 z-10">
        <BookGraph
          data={graphData}
          focusedNodeId={focusedNodeId}
          showLabels={showLabels}
          onBookClick={handleBookClick}
          onBackgroundClick={clearSelection}
        />
      </div>

      {/* Analyzing overlay */}
      {analyzing && (
        <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
          <div className="rounded-xl bg-[#0d0d22]/90 backdrop-blur border border-white/8 px-5 py-3 flex items-center gap-3 shadow-xl">
            <div className="w-3 h-3 rounded-full bg-violet-500 animate-pulse" />
            <span className="text-xs text-white/50">Computing connections…</span>
          </div>
        </div>
      )}

      {/* Top-left HUD */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center gap-3 flex-wrap">
        {readOnly ? (
          <span className="flex items-center gap-1.5 text-white/30 text-sm">
            <span>🌌</span> Book Constellation
          </span>
        ) : (
          <>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors text-sm"
            >
              <span>🌌</span> Book Constellation
            </button>
            <button onClick={() => router.push("/")} className={HUD_BUTTON}>
              + Add books
            </button>
            <button
              onClick={() => {
                if (confirm("Clear your entire library? This cannot be undone.")) {
                  clearLibrary();
                  router.push("/");
                }
              }}
              className={`${HUD_BUTTON} hover:text-red-400! hover:border-red-400/20!`}
            >
              Clear
            </button>
            <button
              disabled={analyzing || edges.length === 0}
              onClick={() => downloadLibrary(books, edges)}
              className={`${HUD_BUTTON} disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              Export JSON
            </button>
          </>
        )}
        <SearchBar books={graphBooks} onSelect={handleSearchSelect} />
        <button
          onClick={() => setShowLabels((v) => !v)}
          aria-pressed={showLabels}
          className={showLabels
            ? "px-3 py-1.5 rounded-lg border text-xs transition-colors bg-violet-900/40 border-violet-500/40 text-violet-300"
            : HUD_BUTTON}
        >
          Labels
        </button>
      </div>

      {/* Sidebar */}
      <BookSidebar
        book={selectedBook}
        connections={connections}
        onClose={clearSelection}
        onBookClick={handleBookClick}
      />

      {/* Legend */}
      <GraphLegend />

      {/* No connections hint */}
      {graphData.links.length === 0 && graphData.nodes.length > 0 && !analyzing && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 text-xs text-white/25 text-center">
          No connections yet — books need shared genres to link.
        </div>
      )}
    </div>
  );
}
