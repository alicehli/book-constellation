"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Book, EnrichmentProgress } from "@/lib/types";
import { AnalyzerEdge } from "@/lib/analyzer";
import { enrichBooks } from "@/lib/googleBooks";
import { loadBooks, mergeBooks, saveBooks } from "@/lib/storage";
import { hasKnownGenre } from "@/lib/buildGraph";

const READ_ONLY = process.env.NEXT_PUBLIC_READ_ONLY === "true";

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [precomputedEdges, setPrecomputedEdges] = useState<AnalyzerEdge[] | undefined>(undefined);
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const reEnrichDoneRef = useRef(false);

  // Load on mount: static JSON in read-only mode, localStorage otherwise
  useEffect(() => {
    if (READ_ONLY) {
      fetch("/alice-library.json")
        .then((r) => r.json())
        .then((data: { books: Book[]; edges: AnalyzerEdge[] }) => {
          setBooks(data.books ?? []);
          setPrecomputedEdges(data.edges ?? []);
          setHydrated(true);
        })
        .catch(() => setHydrated(true));
    } else {
      setBooks(loadBooks());
      setHydrated(true);
    }
  }, []);

  // One-time background pass: silently re-enrich any book that was marked enriched
  // but came back with no subjects (e.g. wrong Google Books result was cached).
  // Persisted to localStorage so it only ever runs once across page navigations.
  useEffect(() => {
    if (READ_ONLY) return;
    if (!hydrated || reEnrichDoneRef.current || books.length === 0) return;
    if (localStorage.getItem("bookgraph-reenriched") === "1") { reEnrichDoneRef.current = true; return; }

    const noSubjects = books.filter(
      (b) => b.enriched && (b.subjects.length === 0 || !hasKnownGenre(b.subjects))
    );
    reEnrichDoneRef.current = true;
    localStorage.setItem("bookgraph-reenriched", "1");
    if (noSubjects.length === 0) return;

    enrichBooks(noSubjects, () => {}).then((fixed) => {
      const fixedMap = new Map(fixed.map((b) => [b.id, b]));
      setBooks((prev) => prev.map((b) => {
        const f = fixedMap.get(b.id);
        return (f && f.subjects.length > 0) ? f : b;
      }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Persist whenever books change (after hydration, non-read-only only)
  useEffect(() => {
    if (!READ_ONLY && hydrated) saveBooks(books);
  }, [books, hydrated]);

  const addBooks = useCallback(async (incoming: Book[]) => {
    if (READ_ONLY) return;

    setBooks((prev) => mergeBooks(prev, incoming));

    const toEnrich = incoming.filter((b) => !b.enriched);
    if (toEnrich.length === 0) return;

    setProgress({ total: toEnrich.length, current: 0, currentTitle: "", done: false });

    const enriched = await enrichBooks(toEnrich, (current, currentTitle) => {
      setProgress({ total: toEnrich.length, current, currentTitle, done: false });
    });

    const enrichedMap = new Map(enriched.map((b) => [b.id, b]));
    setBooks((prev) => prev.map((b) => enrichedMap.get(b.id) ?? b));

    setProgress((p) => (p ? { ...p, done: true } : null));
    setTimeout(() => setProgress(null), 2000);
  }, []);

  const clearLibrary = useCallback(() => {
    if (READ_ONLY) return;
    setBooks([]);
  }, []);

  return { books, precomputedEdges, addBooks, clearLibrary, progress, hydrated, readOnly: READ_ONLY };
}
