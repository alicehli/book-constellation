"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CSVDropzone from "./CSVDropzone";
import TextImport from "./TextImport";
import MatchConfirm, { MatchGroup } from "./MatchConfirm";
import { useBooks } from "@/hooks/useBooks";
import { findCandidates, candidateToBook } from "@/lib/googleBooks";
import { GoogleBooksCandidate, Book } from "@/lib/types";

type Step = "input" | "confirming";

export default function ImportSection() {
  const { books, addBooks, progress } = useBooks();
  const router = useRouter();
  const [tab, setTab] = useState<"csv" | "text">("csv");
  const [step, setStep] = useState<Step>("input");
  const [matchGroups, setMatchGroups] = useState<MatchGroup[]>([]);
  const [searching, setSearching] = useState(false);

  const handleCSVBooks = async (parsed: Book[]) => {
    await addBooks(parsed);
    router.push("/graph");
  };

  const handleTextTitles = async (titles: string[]) => {
    setSearching(true);
    const groups: MatchGroup[] = await Promise.all(
      titles.map(async (query) => {
        try {
          const candidates = await findCandidates(query);
          return { query, candidates, selected: candidates[0] ?? null };
        } catch {
          return { query, candidates: [], selected: null };
        }
      })
    );
    setMatchGroups(groups);
    setSearching(false);
    setStep("confirming");
  };

  const handleConfirm = async (selected: GoogleBooksCandidate[]) => {
    const newBooks = selected.map(candidateToBook);
    await addBooks(newBooks);
    router.push("/graph");
  };

  const isEnriching = progress !== null && !progress.done;

  return (
    <div className="w-full max-w-lg">
      {step === "input" && (
        <>
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-white/[0.04] border border-white/8 p-1 mb-6">
            {(["csv", "text"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors
                  ${tab === t
                    ? "bg-violet-600 text-white"
                    : "text-white/40 hover:text-white/70"
                  }`}
              >
                {t === "csv" ? "Goodreads CSV" : "Type titles"}
              </button>
            ))}
          </div>

          {tab === "csv" ? (
            <CSVDropzone onBooks={handleCSVBooks} />
          ) : (
            <TextImport onTitles={handleTextTitles} loading={searching} />
          )}

          {/* Enrichment progress */}
          {isEnriching && progress && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-xs text-white/40">
                <span>Enriching "{progress.currentTitle}"</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-white/10">
                <div
                  className="h-1 rounded-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Go to graph if library already exists */}
          {books.length > 0 && !isEnriching && (
            <button
              onClick={() => router.push("/graph")}
              className="mt-6 w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
            >
              View existing library ({books.length} books) →
            </button>
          )}
        </>
      )}

      {step === "confirming" && (
        <MatchConfirm
          groups={matchGroups}
          onConfirm={handleConfirm}
          onCancel={() => setStep("input")}
        />
      )}
    </div>
  );
}
