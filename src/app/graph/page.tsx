"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BookGraph from "@/components/graph/BookGraph";
import BookSidebar, { type SimilarBook } from "@/components/graph/BookSidebar";
import GraphLegend from "@/components/graph/GraphLegend";
import SearchBar from "@/components/graph/SearchBar";
import { useBooks } from "@/hooks/useBooks";
import { useGraph } from "@/hooks/useGraph";
import { Book, GraphNode } from "@/lib/types";
import { getAnalysisMode } from "@/lib/analyzer";

export default function GraphPage() {
  const router = useRouter();
  const { books, clearLibrary, progress, hydrated } = useBooks();

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);

  const { graphData, analyzing } = useGraph(books);

  const isClaudeMode = getAnalysisMode() === "claude";

  const connections = useMemo((): SimilarBook[] => {
    if (!selectedBook) return [];
    const bookMap = new Map(graphData.nodes.map((n) => [n.id, n.book]));
    return graphData.links
      .flatMap((l) => {
        const src = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
        const tgt = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
        if (src === selectedBook.id) return [{ id: tgt, l }];
        if (tgt === selectedBook.id) return [{ id: src, l }];
        return [];
      })
      .map(({ id, l }) => {
        const other = bookMap.get(id);
        return other ? { book: other, weight: l.weight, themes: l.sharedSubjects } : null;
      })
      .filter((x): x is SimilarBook => x !== null)
      .sort((a, b) => b.themes.length - a.themes.length || b.weight - a.weight);
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

  const handleBackgroundClick = useCallback(() => {
    setSelectedBook(null);
    setFocusedNodeId(null);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSelectedBook(null);
    setFocusedNodeId(null);
  }, []);

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
          <button
            onClick={() => router.push("/")}
            className="text-violet-400 hover:text-violet-300 text-sm underline underline-offset-2"
          >
            Import some books
          </button>
        </div>
      </div>
    );
  }

  const isEnriching = progress !== null && !progress.done;

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
          onBackgroundClick={handleBackgroundClick}
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
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors text-sm"
        >
          <span>🌌</span> Book Constellation
        </button>
        <button
          onClick={() => router.push("/")}
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/8 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
        >
          + Add books
        </button>
        <button
          onClick={() => {
            if (confirm("Clear your entire library? This cannot be undone.")) {
              clearLibrary();
              router.push("/");
            }
          }}
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/8 text-xs text-white/30 hover:text-red-400 hover:border-red-400/20 transition-colors"
        >
          Clear
        </button>
        <SearchBar books={books} onSelect={handleBookClick} />
        <button
          onClick={() => setShowLabels((v) => !v)}
          className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
            showLabels
              ? "bg-violet-900/40 border-violet-500/40 text-violet-300"
              : "bg-white/[0.04] border-white/8 text-white/40 hover:text-white/70 hover:border-white/20"
          }`}
        >
          Labels
        </button>
      </div>

      {/* Sidebar */}
      <BookSidebar
        book={selectedBook}
        connections={connections}
        enrichedTokens={[]}
        isClaudeMode={isClaudeMode}
        onClose={handleSidebarClose}
        onBookClick={handleBookClick}
      />

      {/* Legend */}
      <GraphLegend />

      {/* Enrichment progress */}
      {isEnriching && progress && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-72">
          <div className="rounded-xl bg-[#0d0d22]/90 backdrop-blur border border-white/8 px-4 py-3 shadow-xl">
            <div className="flex justify-between text-xs text-white/40 mb-2">
              <span className="truncate max-w-[160px]">Enriching "{progress.currentTitle}"</span>
              <span className="flex-shrink-0">{progress.current} / {progress.total}</span>
            </div>
            <div className="h-1 w-full rounded-full bg-white/10">
              <div
                className="h-1 rounded-full bg-violet-500 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* No connections hint */}
      {graphData.links.length === 0 && graphData.nodes.length > 0 && !isEnriching && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 text-xs text-white/25 text-center">
          No connections yet — books need shared genres to link.
        </div>
      )}
    </div>
  );
}
