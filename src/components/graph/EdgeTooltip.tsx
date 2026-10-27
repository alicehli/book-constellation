"use client";

import { GraphLink } from "@/lib/types";
import { formatTheme } from "@/lib/format";

interface Props {
  link: GraphLink | null;
  x: number;
  y: number;
}

export default function EdgeTooltip({ link, x, y }: Props) {
  if (!link) return null;

  return (
    <div
      className="fixed z-40 pointer-events-none"
      // Clamp so the tooltip (max-w-56 = 224px) never runs off the right/bottom edge
      style={{
        left: Math.min(x + 12, window.innerWidth - 236),
        top: Math.min(y - 8, window.innerHeight - 120),
      }}
    >
      <div className="bg-[#12122a]/95 backdrop-blur border border-white/10 rounded-xl px-3 py-2 shadow-xl max-w-56">
        <p className="text-xs text-white/35 mb-1.5 uppercase tracking-wider">Shared themes</p>
        <div className="flex flex-wrap gap-1">
          {link.sharedSubjects.map((s) => (
            <span
              key={s}
              className="px-1.5 py-0.5 rounded-full bg-violet-900/40 border border-violet-500/20 text-xs text-violet-200/70"
            >
              {formatTheme(s)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
