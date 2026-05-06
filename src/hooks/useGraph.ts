"use client";

import { useEffect, useRef, useState } from "react";
import { Book, GraphData } from "@/lib/types";
import { analyzeBooks, buildEdges, BookThemes, AnalyzerEdge } from "@/lib/analyzer";
import { buildGraph } from "@/lib/buildGraph";

const EMPTY: GraphData = { nodes: [], links: [] };

export function useGraph(
  books: Book[],
  precomputedEdges?: AnalyzerEdge[]
): { graphData: GraphData; analyzing: boolean; themesMap: Map<string, BookThemes>; edges: AnalyzerEdge[] } {
  const [graphData, setGraphData] = useState<GraphData>(EMPTY);
  const [analyzing, setAnalyzing] = useState(false);
  const [themesMap, setThemesMap] = useState<Map<string, BookThemes>>(new Map());
  const [edges, setEdges] = useState<AnalyzerEdge[]>([]);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (books.length === 0) {
      setGraphData(EMPTY);
      setThemesMap(new Map());
      setEdges([]);
      return;
    }

    // In read-only mode with pre-baked edges, skip all analysis
    if (precomputedEdges && precomputedEdges.length > 0) {
      setGraphData(buildGraph(books, precomputedEdges));
      setEdges(precomputedEdges);
      setAnalyzing(false);
      return;
    }

    cancelRef.current = false;
    setAnalyzing(true);

    analyzeBooks(books).then(async (themes) => {
      if (cancelRef.current) return;
      const computed = await buildEdges(themes);
      if (cancelRef.current) return;
      setGraphData(buildGraph(books, computed));
      setThemesMap(new Map(themes.map((t) => [t.bookId, t])));
      setEdges(computed);
      setAnalyzing(false);
    });

    return () => {
      cancelRef.current = true;
    };
  }, [books, precomputedEdges]);

  return { graphData, analyzing, themesMap, edges };
}
