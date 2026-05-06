"use client";

import { useEffect, useState } from "react";
import { Book } from "@/lib/types";
import { MAX_SCORE_LOCAL } from "@/lib/analyzer";

export interface SimilarBook {
  book: Book;
  weight: number;
  themes: string[];
}

interface Props {
  book: Book | null;
  connections: SimilarBook[];
  enrichedTokens?: string[];
  isClaudeMode?: boolean;
  onClose: () => void;
  onBookClick: (book: Book) => void;
}

function Stars({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <span className="text-amber-400 text-sm">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

export default function BookSidebar({ book, connections, enrichedTokens = [], isClaudeMode = false, onClose, onBookClick }: Props) {
  const [reviewExpanded, setReviewExpanded] = useState(false);
  useEffect(() => { setReviewExpanded(false); }, [book?.id]);

  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 bg-[#0d0d22]/95 backdrop-blur-md border-l border-white/8
        flex flex-col z-30 transition-transform duration-300 ease-out
        ${book ? "translate-x-0" : "translate-x-full"}`}
    >
      {book && (
        <>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <span className="text-xs text-white/30 font-medium uppercase tracking-wider">Details</span>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 custom-scroll">
            {/* Cover */}
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

            {/* Title & author */}
            <div className="text-center">
              <h2 className="text-base font-semibold text-white/90 leading-snug">{book.title}</h2>
              <p className="text-sm text-white/45 mt-0.5">{book.author}</p>
            </div>

            {/* Meta row */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {book.rating && <Stars rating={book.rating} />}
              {book.dateRead && (
                <span className="text-xs text-white/30">Read {book.dateRead}</span>
              )}
              {book.publishedYear && (
                <span className="text-xs text-white/30">{book.publishedYear}</span>
              )}
            </div>

            {/* Tags — enriched (claude mode) or Google Books subjects (local mode) */}
            {enrichedTokens.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {enrichedTokens.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full bg-violet-900/40 border border-violet-500/20 text-xs text-violet-200/70"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : book.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {book.subjects.slice(0, 6).map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/40"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {book.description && (
              <p className="text-sm text-white/45 leading-relaxed">
                {book.description}
                {/[^.!?…]$/.test(book.description.trimEnd()) ? '…' : ''}
              </p>
            )}

            {/* Similar books */}
            {connections.length > 0 && (
              <div className="border-t border-white/8 pt-4 space-y-3">
                <p className="text-xs text-white/25 uppercase tracking-wider">Connected books</p>
                {connections.map(({ book: other, weight, themes }) => (
                  <button
                    key={other.id}
                    onClick={() => onBookClick(other)}
                    className="w-full flex items-start gap-3 text-left group"
                  >
                    {other.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={other.coverUrl}
                        alt={other.title}
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
                        {!isClaudeMode && (
                          <span className="text-[10px] text-white/25 tabular-nums flex-shrink-0">
                            {Math.round((weight / MAX_SCORE_LOCAL) * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/35 mt-0.5 truncate">{other.author}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {themes.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded bg-violet-900/30 text-violet-300/60 text-xs"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* User review */}
            {book.review && (() => {
              const paragraphs = book.review
                .split(/<br\s*\/?>/gi)
                .map((p) => p.replace(/<[^>]*>/g, "").trim())
                .filter(Boolean);
              if (paragraphs.length === 0) return null;
              const collapsed = !reviewExpanded && paragraphs.length > 2;
              const visible = collapsed ? paragraphs.slice(0, 2) : paragraphs;
              return (
                <div className="border-t border-white/8 pt-4">
                  <p className="text-xs text-white/25 uppercase tracking-wider mb-2">My review</p>
                  <div className="space-y-2">
                    {visible.map((p, i) => (
                      <p key={i} className="text-sm text-white/50 leading-relaxed italic">{p}</p>
                    ))}
                  </div>
                  {paragraphs.length > 2 && (
                    <button
                      onClick={() => setReviewExpanded((v) => !v)}
                      className="mt-2 text-xs text-white/25 hover:text-white/50 transition-colors"
                    >
                      {reviewExpanded ? "Show less" : `Read more (${paragraphs.length - 2} more)`}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Shelves */}
            {book.shelves.length > 0 && (
              <div className="border-t border-white/8 pt-4">
                <p className="text-xs text-white/25 uppercase tracking-wider mb-2">Shelves</p>
                <p className="text-sm text-white/40">{book.shelves.join(", ")}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
