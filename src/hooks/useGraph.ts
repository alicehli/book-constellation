"use client";

import { useEffect, useRef, useState } from "react";
import { Book, GraphData } from "@/lib/types";
import { analyzeBooks, buildEdges, BookThemes } from "@/lib/analyzer";
import { buildGraph } from "@/lib/buildGraph";

const EMPTY: GraphData = { nodes: [], links: [] };

export function useGraph(books: Book[]): { graphData: GraphData; analyzing: boolean; themesMap: Map<string, BookThemes> } {
  const [graphData, setGraphData] = useState<GraphData>(EMPTY);
  const [analyzing, setAnalyzing] = useState(false);
  const [themesMap, setThemesMap] = useState<Map<string, BookThemes>>(new Map());
  const cancelRef = useRef(false);

  useEffect(() => {
    if (books.length === 0) {
      setGraphData(EMPTY);
      setThemesMap(new Map());
      return;
    }

    cancelRef.current = false;
    setAnalyzing(true);

    analyzeBooks(books).then(async (themes) => {
      if (cancelRef.current) return;
      const edges = await buildEdges(themes);
      if (cancelRef.current) return;
      setGraphData(buildGraph(books, edges));
      setThemesMap(new Map(themes.map((t) => [t.bookId, t])));
      setAnalyzing(false);
    });

    return () => {
      cancelRef.current = true;
    };
  }, [books]);

  return { graphData, analyzing, themesMap };
}
