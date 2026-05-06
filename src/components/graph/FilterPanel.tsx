"use client";

import { GraphFilters } from "@/lib/types";

interface Props {
  filters: GraphFilters;
  onChange: (f: GraphFilters) => void;
}

const RATING_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 3, label: "3★+" },
  { value: 4, label: "4★+" },
  { value: 5, label: "5★" },
];

export default function FilterPanel({ filters, onChange }: Props) {
  const set = (patch: Partial<GraphFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] border border-white/8 p-1">
      {RATING_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => set({ minRating: opt.value })}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
            ${filters.minRating === opt.value
              ? "bg-violet-600 text-white"
              : "text-white/35 hover:text-white/65"
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
