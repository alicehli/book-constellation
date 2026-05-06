"use client";

import { useCallback, useState } from "react";
import { parseGoodreadsCSV } from "@/lib/parseInput";
import { Book } from "@/lib/types";

interface Props {
  onBooks: (books: Book[]) => void;
}

export default function CSVDropzone({ onBooks }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.name.endsWith(".csv")) {
        setError("Please upload a .csv file exported from Goodreads.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const books = parseGoodreadsCSV(text);
          if (books.length === 0) {
            setError("No books found — make sure this is a Goodreads export CSV.");
            return;
          }
          onBooks(books);
        } catch {
          setError("Failed to parse CSV. Make sure it's a Goodreads export.");
        }
      };
      reader.readAsText(file);
    },
    [onBooks]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer
          ${dragging
            ? "border-violet-400 bg-violet-950/20"
            : "border-white/10 hover:border-white/25 bg-white/[0.02]"
          }`}
      >
        <input
          type="file"
          accept=".csv"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }}
        />
        <div className="text-3xl mb-3">📚</div>
        <p className="text-sm text-white/60 text-center">
          Drop your Goodreads CSV here, or click to browse
        </p>
        <p className="text-xs text-white/30 mt-1">
          Goodreads → My Books → Export
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
