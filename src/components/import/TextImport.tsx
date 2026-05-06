"use client";

import { useState } from "react";
import { parsePlainText } from "@/lib/parseInput";

interface Props {
  onTitles: (titles: string[]) => void;
  loading: boolean;
}

export default function TextImport({ onTitles, loading }: Props) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const titles = parsePlainText(text);
    if (titles.length > 0) onTitles(titles);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"The Power Broker, Gilead, Crying in H Mart\n\nor one per line"}
        rows={5}
        className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white/80 placeholder:text-white/25 resize-none focus:outline-none focus:border-violet-500 transition-colors"
      />
      <button
        type="submit"
        disabled={!text.trim() || loading}
        className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium transition-colors"
      >
        {loading ? "Searching…" : "Find Books"}
      </button>
    </form>
  );
}
