"use client";

import { useState } from "react";

const GENRES = [
  { label: "Literary Fiction",       color: "#e8a0bf" },
  { label: "Historical Fiction",     color: "#d4a054" },
  { label: "Science Fiction",        color: "#4fc3f7" },
  { label: "Fantasy",                color: "#4caf50" },
  { label: "Mystery / Thriller",     color: "#ef5350" },
  { label: "History",                color: "#ff9800" },
  { label: "Biography / Memoir",     color: "#ff7043" },
  { label: "Self-Help",              color: "#8bc34a" },
  { label: "Science",                color: "#26c6da" },
  { label: "Philosophy",             color: "#b39ddb" },
  { label: "Political Science",      color: "#5c6bc0" },
  { label: "Social Science",         color: "#ab47bc" },
  { label: "Business / Economics",   color: "#ffd54f" },
  { label: "Religion / Spirituality",color: "#e0e0e0" },
  { label: "Poetry",                 color: "#ce93d8" },
  { label: "Young Adult",            color: "#26a69a" },
  { label: "Computers / Technology", color: "#00bcd4" },
];

function MiniStar({ color }: { color: string }) {
  const outerR = 7, innerR = 3, pts = 5;
  const points = Array.from({ length: pts * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / pts - Math.PI / 2;
    return `${outerR + r * Math.cos(a)},${outerR + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg width={outerR * 2} height={outerR * 2} className="flex-shrink-0">
      <polygon points={points} fill={color} />
    </svg>
  );
}

function MiniDiamond({ color }: { color: string }) {
  return (
    <svg width={14} height={14} className="flex-shrink-0">
      <polygon points="7,1 13,7 7,13 1,7" fill={color} />
    </svg>
  );
}

function MiniCircle({ color }: { color: string }) {
  return (
    <svg width={12} height={12} className="flex-shrink-0">
      <circle cx={6} cy={6} r={5} fill={color} />
    </svg>
  );
}

export default function GraphLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-5 right-5 z-20 flex flex-col items-end gap-2">
      {open && (
        <div className="rounded-xl bg-[#0d0d22]/95 backdrop-blur border border-white/8 p-5 shadow-2xl w-64 space-y-5">
          {/* Shapes */}
          <div>
            <p className="text-xs text-white/25 uppercase tracking-wider mb-3">Shape = rating</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <MiniStar color="#c084fc" />
                <span className="text-sm text-white/55">5★ — five-pointed star</span>
              </div>
              <div className="flex items-center gap-3">
                <MiniDiamond color="#a78bfa" />
                <span className="text-sm text-white/55">4★ — diamond</span>
              </div>
              <div className="flex items-center gap-3">
                <MiniCircle color="#94a3b8" />
                <span className="text-sm text-white/55">≤3★ — circle</span>
              </div>
            </div>
          </div>

          {/* Colors */}
          <div>
            <p className="text-xs text-white/25 uppercase tracking-wider mb-3">Color = genre</p>
            <div className="space-y-1.5">
              {GENRES.map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-xs text-white/45">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Glow note */}
          <p className="text-xs text-white/25 leading-relaxed border-t border-white/8 pt-4">
            Soft glow = book has a personal review.<br />
            Lines trace shared themes.<br />
            Click on stars further in the galaxy to see books to read!
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
          open
            ? "bg-violet-900/40 border-violet-500/40 text-violet-300"
            : "bg-white/[0.04] border-white/8 text-white/40 hover:text-white/70 hover:border-white/20"
        }`}
      >
        Key
      </button>
    </div>
  );
}
