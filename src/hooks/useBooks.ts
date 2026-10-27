"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Book, EnrichmentProgress } from "@/lib/types";
import { AnalyzerEdge, clearClaudeEdgeCache } from "@/lib/analyzer";
import { enrichBooks } from "@/lib/googleBooks";
import { loadBooks, novelBooks, saveBooks } from "@/lib/storage";
import { hasKnownGenre } from "@/lib/buildGraph";

export const READ_ONLY = process.env.NEXT_PUBLIC_READ_ONLY === "true";
const REENRICH_FLAG_KEY = "bookgraph-reenriched";
let backgroundPassStarted = false;

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [precomputedEdges, setPrecomputedEdges] = useState<AnalyzerEdge[] | undefined>(undefined);
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const booksRef = useRef<Book[]>([]);
  useEffect(() => { booksRef.current = books; }, [books]);

  // Load on mount: static JSON in read-only mode, localStorage otherwise
  useEffect(() => {
    if (READ_ONLY) {
      fetch("/alice-library.json")
        .then((r) => r.json())
        .then((data: { books: Book[]; edges: AnalyzerEdge[] }) => {
          setBooks(data.books ?? []);
          setPrecomputedEdges(data.edges ?? []);
        })
        .catch((err) => console.warn("Failed to load library:", err))
        .finally(() => setHydrated(true));
      return;
    }

    const stored = loadBooks();
    // Deferred so state is set from a callback rather than synchronously in the effect
    queueMicrotask(() => {
      setBooks(stored);
      setHydrated(true);
    });

    // Background repair (once per session, across hook instances): retry books whose
    // lookup failed, plus a one-time pass over books enriched without a known genre
    // (e.g. a wrong Google Books match was cached).
    if (backgroundPassStarted) return;
    backgroundPassStarted = true;
    let genrePassDone = true;
    try { genrePassDone = localStorage.getItem(REENRICH_FLAG_KEY) === "1"; } catch {}
    const stale = stored.filter((b) => !b.enriched || (!genrePassDone && !hasKnownGenre(b.subjects)));
    if (stale.length === 0) {
      try { localStorage.setItem(REENRICH_FLAG_KEY, "1"); } catch {}
      return;
    }
    enrichBooks(stale, () => {}).then((results) => {
      const original = new Map(stale.map((b) => [b.id, b]));
      // Accept a result if the lookup succeeded and it isn't a regression to no subjects
      const fixed = new Map(
        results
          .filter((b) => b.enriched && (b.subjects.length > 0 || !original.get(b.id)!.enriched))
          .map((b) => [b.id, b])
      );
      const apply = (list: Book[]) => list.map((b) => fixed.get(b.id) ?? b);
      // Write straight to storage so results survive even if this component unmounted
      saveBooks(apply(loadBooks()));
      setBooks(apply);
      try { localStorage.setItem(REENRICH_FLAG_KEY, "1"); } catch {}
    });
  }, []);

  // Persist whenever books change (after hydration, non-read-only only)
  useEffect(() => {
    if (!READ_ONLY && hydrated) saveBooks(books);
  }, [books, hydrated]);

  const addBooks = useCallback(async (incoming: Book[]) => {
    if (READ_ONLY) return;

    // Skip books already in the library so we don't re-query Google Books for them
    const fresh = novelBooks(booksRef.current, incoming);
    if (fresh.length === 0) return;
    setBooks((prev) => [...prev, ...novelBooks(prev, fresh)]);

    const toEnrich = fresh.filter((b) => !b.enriched);
    if (toEnrich.length === 0) return;

    setProgress({ total: toEnrich.length, current: 0, currentTitle: "", done: false });

    const enriched = await enrichBooks(toEnrich, (current, currentTitle) => {
      setProgress({ total: toEnrich.length, current, currentTitle, done: false });
    });

    const enrichedMap = new Map(enriched.map((b) => [b.id, b]));
    const next = booksRef.current.map((b) => enrichedMap.get(b.id) ?? b);
    setBooks(next);
    // Save immediately: callers usually navigate away right after this resolves
    saveBooks(next);

    setProgress((p) => (p ? { ...p, done: true } : null));
    setTimeout(() => setProgress(null), 2000);
  }, []);

  const clearLibrary = useCallback(() => {
    if (READ_ONLY) return;
    setBooks([]);
    saveBooks([]);
    clearClaudeEdgeCache();
  }, []);

  return { books, precomputedEdges, addBooks, clearLibrary, progress, hydrated, readOnly: READ_ONLY };
}
