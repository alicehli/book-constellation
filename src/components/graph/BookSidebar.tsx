"use client";

import { useMemo, useState } from "react";
import { Book } from "@/lib/types";
import { blocksToText, parseRichText, type Block } from "@/lib/richText";
import { formatDateRead, formatTheme } from "@/lib/format";
import RichText from "./RichText";

export interface SimilarBook {
  book: Book;
  /** 0–1 match strength; undefined when the edge source has no meaningful score */
  strength?: number;
  themes: string[];
}

interface Props {
  book: Book | null;
  connections: SimilarBook[];
  onClose: () => void;
  onBookClick: (book: Book) => void;
}

const STATUS_SHELVES = new Set(["read", "to-read", "currently-reading"]);
const STATUS_LABELS: Record<string, string> = {
  "to-read": "Want to read",
  "currently-reading": "Currently reading",
};

/** Text longer than this is collapsed behind "Read more" */
const COLLAPSE_CHARS = 600;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-sm" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-white/25 uppercase tracking-wider mb-2">{children}</p>;
}

function Collapsible({ blocks, className }: { blocks: Block[]; className: string }) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = blocksToText(blocks).length > COLLAPSE_CHARS;
  const collapsed = collapsible && !expanded;

  return (
    <div>
      <div
        className={collapsed ? "max-h-48 overflow-hidden" : ""}
        style={collapsed ? { maskImage: "linear-gradient(to bottom, black 60%, transparent)" } : undefined}
      >
        <RichText blocks={blocks} className={className} />
      </div>
      {collapsible && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-violet-300/60 hover:text-violet-300 transition-colors"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function BookDetails({ book, connections, onBookClick }: Omit<Props, "book" | "onClose"> & { book: Book }) {
  const review = useMemo(() => parseRichText(book.review ?? ""), [book.review]);
  const description = useMemo(() => parseRichText(book.description ?? ""), [book.description]);
  const shelves = book.shelves.filter((s) => !STATUS_SHELVES.has(s));
  const status = book.exclusiveShelf ? STATUS_LABELS[book.exclusiveShelf] : undefined;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 custom-scroll">
      {book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.coverUrl}
          alt={book.title}
          className="w-28 rounded-lg shadow-lg shadow-black/50 mx-auto block"
        />
      ) : (
        <div className="w-28 h-40 rounded-lg bg-white/5 mx-auto flex items-center justify-center text-white/15 text-xs">
          No cover
        </div>
      )}

      <div className="text-center">
        <h2 className="text-base font-semibold text-white/90 leading-snug">{book.title}</h2>
        <p className="text-sm text-white/45 mt-0.5">{book.author}</p>
      </div>

      <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap">
        {book.rating ? <Stars rating={book.rating} /> : null}
        {status && (
          <span className="px-2 py-0.5 rounded-full bg-violet-900/30 text-[11px] text-violet-200/70">{status}</span>
        )}
        {book.dateRead && <span className="text-xs text-white/30">Read {formatDateRead(book.dateRead)}</span>}
        {book.publishedYear && <span className="text-xs text-white/30">Published {book.publishedYear}</span>}
      </div>

      {book.subjects.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {book.subjects.slice(0, 6).map((s) => (
            <span key={s} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/40">
              {s}
            </span>
          ))}
        </div>
      )}

      {review.length > 0 && (
        <div className="border-t border-white/8 pt-4">
          <SectionLabel>My review</SectionLabel>
          <Collapsible blocks={review} className="text-sm text-white/60 leading-relaxed" />
        </div>
      )}

      {description.length > 0 && (
        <div className="border-t border-white/8 pt-4">
          <SectionLabel>About</SectionLabel>
          <Collapsible blocks={description} className="text-sm text-white/45 leading-relaxed" />
        </div>
      )}

      {connections.length > 0 && (
        <div className="border-t border-white/8 pt-4 space-y-3">
          <SectionLabel>Connected books</SectionLabel>
          {connections.map(({ book: other, strength, themes }) => (
            <button
              key={other.id}
              onClick={() => onBookClick(other)}
              className="w-full flex items-start gap-3 text-left group"
            >
              {other.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={other.coverUrl}
                  alt=""
                  className="w-9 h-12 rounded object-cover flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                />
              ) : (
                <div className="w-9 h-12 rounded bg-white/5 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm text-white/70 group-hover:text-white/90 transition-colors leading-snug truncate">
                    {other.title}
                  </p>
                  {strength !== undefined && (
                    <span className="text-[10px] text-white/25 tabular-nums flex-shrink-0" title="Match strength">
                      {Math.round(strength * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/35 mt-0.5 truncate">{other.author}</p>
                {themes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {themes.slice(0, 4).map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-violet-900/30 text-violet-300/60 text-xs">
                        {formatTheme(t)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {shelves.length > 0 && (
        <div className="border-t border-white/8 pt-4">
          <SectionLabel>Shelves</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {shelves.map((s) => (
              <span key={s} className="px-2 py-0.5 rounded bg-white/[0.04] text-xs text-white/40">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookSidebar({ book, connections, onClose, onBookClick }: Props) {
  return (
    <aside
      aria-hidden={!book}
      className={`fixed top-0 right-0 h-full w-full sm:w-80 bg-[#0d0d22]/95 backdrop-blur-md border-l border-white/8
        flex flex-col z-30 transition-transform duration-300 ease-out
        ${book ? "translate-x-0" : "translate-x-full"}`}
    >
      {book && (
        <>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <span className="text-xs text-white/30 font-medium uppercase tracking-wider">Details</span>
            <button
              onClick={onClose}
              aria-label="Close details"
              className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>
          {/* key resets collapsed/expanded state when switching books */}
          <BookDetails key={book.id} book={book} connections={connections} onBookClick={onBookClick} />
        </>
      )}
    </aside>
  );
}
