"use client";

import { useEffect, useRef, useState } from "react";
import { Book } from "@/lib/types";

interface Props {
  books: Book[];
  onSelect: (book: Book) => void;
}

export default function SearchBar({ books, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const results = q.length >= 1
    ? books
        .filter(
          (b) =>
            b.title.toLowerCase().includes(q) ||
            b.author.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (book: Book) => {
    onSelect(book);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors
          ${open ? "border-violet-500/50 bg-white/[0.07]" : "border-white/8 bg-white/[0.04]"}`}
      >
        <svg className="w-3 h-3 text-white/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search books…"
          className="bg-transparent text-xs text-white/80 placeholder:text-white/25 outline-none w-32 focus:w-44 transition-all duration-200"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="text-white/25 hover:text-white/60 transition-colors leading-none"
          >
            ✕
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 w-72 rounded-xl bg-[#0d0d22]/95 backdrop-blur border border-white/10 shadow-2xl overflow-hidden z-50">
          {results.map((book) => (
            <button
              key={book.id}
              onClick={() => handleSelect(book)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] transition-colors text-left border-b border-white/5 last:border-0"
            >
              {book.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-7 h-10 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-10 rounded bg-white/8 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs text-white/85 truncate">{book.title}</p>
                <p className="text-xs text-white/35 truncate">{book.author}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
