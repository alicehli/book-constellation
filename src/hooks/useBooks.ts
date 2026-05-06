"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Book, EnrichmentProgress } from "@/lib/types";
import { enrichBooks } from "@/lib/googleBooks";
import { loadBooks, mergeBooks, saveBooks } from "@/lib/storage";

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const reEnrichDoneRef = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    setBooks(loadBooks());
    setHydrated(true);
  }, []);

  // One-time background pass: silently re-enrich any book that was marked enriched
  // but came back with no subjects (e.g. wrong Google Books result was cached).
  useEffect(() => {
    if (!hydrated || reEnrichDoneRef.current || books.length === 0) return;
    const noSubjects = books.filter((b) => b.enriched && b.subjects.length === 0);
    if (noSubjects.length === 0) { reEnrichDoneRef.current = true; return; }

    reEnrichDoneRef.current = true;
    enrichBooks(noSubjects, () => {}).then((fixed) => {
      const fixedMap = new Map(fixed.map((b) => [b.id, b]));
      setBooks((prev) => prev.map((b) => {
        const f = fixedMap.get(b.id);
        return (f && f.subjects.length > 0) ? f : b;
      }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Persist whenever books change (after hydration)
  useEffect(() => {
    if (hydrated) saveBooks(books);
  }, [books, hydrated]);

  const addBooks = useCallback(async (incoming: Book[]) => {
    // Merge first so the graph is usable while enrichment runs
    setBooks((prev) => mergeBooks(prev, incoming));

    // Enrich only the new unenriched books
    const toEnrich = incoming.filter((b) => !b.enriched);
    if (toEnrich.length === 0) return;

    setProgress({ total: toEnrich.length, current: 0, currentTitle: "", done: false });

    const enriched = await enrichBooks(toEnrich, (current, currentTitle) => {
      setProgress({ total: toEnrich.length, current, currentTitle, done: false });
    });

    // Merge enriched versions back in by id
    const enrichedMap = new Map(enriched.map((b) => [b.id, b]));
    setBooks((prev) =>
      prev.map((b) => enrichedMap.get(b.id) ?? b)
    );

    setProgress((p) => (p ? { ...p, done: true } : null));
    setTimeout(() => setProgress(null), 2000);
  }, []);

  const clearLibrary = useCallback(() => {
    setBooks([]);
  }, []);

  return { books, addBooks, clearLibrary, progress, hydrated };
}
