"use client";

import { useEffect, useMemo, useState } from "react";
import { useBooks } from "@/hooks/useBooks";
import {
  analyzeBooks, buildEdges, clearClaudeEdgeCache,
  setAnalysisMode, getAnalysisMode,
  MAX_SCORE_LOCAL, MAX_SCORE_CLAUDE,
} from "@/lib/analyzer";
import type { AnalyzerEdge, BookThemes } from "@/lib/analyzer";

export default function DebugPage() {
  const { books, hydrated } = useBooks();
  const [edges, setEdges] = useState<AnalyzerEdge[]>([]);
  const [themesMap, setThemesMap] = useState<Map<string, BookThemes>>(new Map());
  const [analyzing, setAnalyzing] = useState(false);
  const [reEnrichSeq, setReEnrichSeq] = useState(0);
  const [mode, setMode] = useState<"local" | "claude">("local"); // "local" is safe for SSR
  const [modeReady, setModeReady] = useState(false);

  // Read persisted mode on client mount — avoids SSR/localStorage mismatch
  useEffect(() => {
    setMode(getAnalysisMode());
    setModeReady(true);
  }, []);

  const maxScore = mode === "claude" ? MAX_SCORE_CLAUDE : MAX_SCORE_LOCAL;

  useEffect(() => {
    if (!modeReady || !hydrated || books.length === 0) return;
    setAnalyzing(true);
    analyzeBooks(books).then(async (themes) => {
      const edges = await buildEdges(themes);
      setEdges(edges);
      setThemesMap(new Map(themes.map((t) => [t.bookId, t])));
      setAnalyzing(false);
    });
  }, [books, hydrated, reEnrichSeq, modeReady]);

  function handleReEnrich() {
    clearClaudeEdgeCache();
    setReEnrichSeq((n) => n + 1);
  }

  function handleModeToggle() {
    const next = mode === "local" ? "claude" : "local";
    setAnalysisMode(next);
    setMode(next);
    setReEnrichSeq((n) => n + 1);
  }

  const titleOf = useMemo(
    () => new Map(books.map((b) => [b.id, b.title])),
    [books]
  );

  const byBook = useMemo(() => {
    return books
      .map((book) => {
        const aThemes = themesMap.get(book.id);
        const aCombined = new Set([
          ...(aThemes?.categoryTokens ?? []),
          ...(aThemes?.descriptionTokens ?? []),
        ]);

        const connections = edges
          .filter((e) => e.source === book.id || e.target === book.id)
          .map((e) => {
            const otherId = e.source === book.id ? e.target : e.source;
            const bThemes = themesMap.get(otherId);
            const bCombined = [
              ...(bThemes?.categoryTokens ?? []),
              ...(bThemes?.descriptionTokens ?? []),
            ];
            const sharedTokens = [...new Set(bCombined.filter((t) => aCombined.has(t)))];
            return {
              id: otherId,
              title: titleOf.get(otherId) ?? otherId,
              score: e.score,
              pct: ((e.score / maxScore) * 100).toFixed(0) + "%",
              themes: [...new Set(e.sharedThemes)],
              sharedTokens,
              breakdown: {
                tfidfCat:      e.breakdown.tfidfCat.toFixed(3),
                tfidfDesc:     e.breakdown.tfidfDesc.toFixed(3),
                tfidfEnriched: e.breakdown.tfidfEnriched.toFixed(3),
                tfidfShelf:    e.breakdown.tfidfShelf.toFixed(3),
                rating:        e.breakdown.rating.toFixed(3),
              },
            };
          })
          .sort((a, b) => b.score - a.score);
        return { book, degree: connections.length, connections };
      })
      .sort((a, b) => b.degree - a.degree || a.book.title.localeCompare(b.book.title));
  }, [books, edges, titleOf, themesMap]);

  return (
    <div className="min-h-screen bg-[#070714] text-white/80 font-mono text-xs p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/graph" className="hover:opacity-70 transition-opacity">🌌</a>
            <span className="text-white/40">Book Constellation / analyzer debug</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/20 text-[10px]">mode:</span>
            <button
              onClick={handleModeToggle}
              disabled={analyzing}
              className={`px-2 py-1 rounded text-[10px] disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                mode === "claude"
                  ? "bg-violet-900/50 text-violet-300/80 hover:bg-violet-900/30"
                  : "bg-white/5 text-white/40 hover:bg-violet-900/40 hover:text-violet-300/70"
              }`}
            >
              {mode}
            </button>
            {mode === "claude" && (
              <button
                onClick={handleReEnrich}
                disabled={analyzing}
                className="px-2 py-1 rounded text-[10px] bg-white/5 text-white/30 hover:bg-violet-900/40 hover:text-violet-300/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                re-analyze
              </button>
            )}
          </div>
        </div>

        {!hydrated ? (
          <p className="text-white/30 animate-pulse">Loading library…</p>
        ) : books.length === 0 ? (
          <p className="text-white/30">No books in library. Import a CSV first.</p>
        ) : !modeReady || analyzing ? (
          <p className="text-white/30 animate-pulse">
            {!modeReady ? "Loading…" : `Analyzing${mode === "claude" ? " (claude)" : ""}…`}
          </p>
        ) : (
          <>
            <p className="text-white/40">
              {books.length} books → {edges.length} edges
            </p>

            <div className="space-y-6">
              {byBook.map(({ book, degree, connections }) => (
                <div key={book.id}>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-white/80 font-semibold">{book.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      degree === 0
                        ? "bg-white/5 text-white/20"
                        : "bg-violet-900/50 text-violet-300/70"
                    }`}>
                      {degree} connection{degree !== 1 ? "s" : ""}
                    </span>
                    {book.rating ? (
                      <span className="text-amber-400/60">{"★".repeat(book.rating)}</span>
                    ) : null}
                  </div>

                  {connections.length === 0 ? (
                    <p className="text-white/20 pl-3 border-l border-white/5">isolated</p>
                  ) : (
                    <div className="space-y-1 pl-3 border-l border-white/8">
                      {connections.map((c) => (
                        <div
                          key={c.id}
                          className="grid items-start gap-x-3"
                          style={{ gridTemplateColumns: "3rem 1fr auto" }}
                        >
                          <span className="text-violet-400 font-bold tabular-nums">{c.pct}</span>
                          <div>
                            <span className="text-white/65">{c.title}</span>
                            {c.themes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {c.themes.map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.5 rounded bg-violet-900/30 text-violet-300/60 text-[10px]"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            {c.sharedTokens.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {c.sharedTokens.map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.5 rounded bg-white/5 text-white/30 text-[10px]"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right text-white/25 text-[10px] leading-4 whitespace-nowrap">
                            <div>cat  {c.breakdown.tfidfCat}</div>
                            <div>desc {c.breakdown.tfidfDesc}</div>
                            <div>enr  {c.breakdown.tfidfEnriched}</div>
                            <div>shf  {c.breakdown.tfidfShelf}</div>
                            <div>rtg  {c.breakdown.rating}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
