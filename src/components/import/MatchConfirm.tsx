"use client";

import { useState } from "react";
import { GoogleBooksCandidate } from "@/lib/types";

interface MatchGroup {
  query: string;
  candidates: GoogleBooksCandidate[];
  selected: GoogleBooksCandidate | null;
}

interface Props {
  groups: MatchGroup[];
  onConfirm: (selected: GoogleBooksCandidate[]) => void;
  onCancel: () => void;
}

export default function MatchConfirm({ groups: initial, onConfirm, onCancel }: Props) {
  const [groups, setGroups] = useState<MatchGroup[]>(initial);

  const select = (groupIdx: number, candidate: GoogleBooksCandidate | null) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === groupIdx ? { ...g, selected: candidate } : g))
    );
  };

  const confirmed = groups
    .map((g) => g.selected)
    .filter((c): c is GoogleBooksCandidate => c !== null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        Review matches below. Deselect any incorrect results before adding to your library.
      </p>

      <div className="space-y-5 max-h-[480px] overflow-y-auto pr-1 custom-scroll">
        {groups.map((group, gi) => (
          <div key={gi}>
            <p className="text-xs text-white/35 mb-2">Query: "{group.query}"</p>
            <div className="space-y-2">
              {group.candidates.length === 0 ? (
                <p className="text-xs text-white/30 italic">No results found.</p>
              ) : (
                group.candidates.map((c) => {
                  const isSelected = group.selected?.googleBooksId === c.googleBooksId;
                  return (
                    <button
                      key={c.googleBooksId}
                      onClick={() => select(gi, isSelected ? null : c)}
                      className={`w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-all
                        ${isSelected
                          ? "border-violet-500 bg-violet-950/30"
                          : "border-white/8 bg-white/[0.02] hover:border-white/20"
                        }`}
                    >
                      {c.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.coverUrl}
                          alt={c.title}
                          className="w-10 h-14 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-14 rounded bg-white/10 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate">{c.title}</p>
                        <p className="text-xs text-white/50">{c.author}</p>
                        {c.publishedYear && (
                          <p className="text-xs text-white/30">{c.publishedYear}</p>
                        )}
                        {c.subjects.length > 0 && (
                          <p className="text-xs text-violet-300/60 mt-0.5 truncate">
                            {c.subjects.slice(0, 3).join(" · ")}
                          </p>
                        )}
                      </div>
                      <div className={`ml-auto w-4 h-4 rounded-full border flex-shrink-0 mt-0.5 transition-colors
                        ${isSelected ? "bg-violet-500 border-violet-500" : "border-white/20"}`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(confirmed)}
          disabled={confirmed.length === 0}
          className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed py-2.5 text-sm font-medium transition-colors"
        >
          Add {confirmed.length} book{confirmed.length !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

export type { MatchGroup };
