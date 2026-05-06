import { Book, GraphData, GraphLink, GraphNode } from "./types";
import type { AnalyzerEdge } from "./analyzer";

// ─── Config ──────────────────────────────────────────────────────────────────

/** Below this node count, labels are always visible; above it, hover-only */
export const LABEL_VISIBILITY_THRESHOLD = 40;

// ─── Color mapping ──────────────────────────────────────────────────────────
// Keys are matched as substrings of Google Books subject strings.
// Longer keys take priority (checked first), so "Science Fiction" beats "Science".

const GENRE_COLORS: Record<string, string> = {
  // ── Compound / multi-word (longest → most specific, checked first) ──
  "Body, Mind & Spirit": "#e0e0e0", // Google Books umbrella for religion/spirituality
  "Literary Fiction":    "#e8a0bf",
  "Historical Fiction":  "#d4a054",
  "Science Fiction":     "#4fc3f7",
  "Political Science":   "#5c6bc0",
  "Social Science":      "#ab47bc",
  "Christian Living":    "#e0e0e0",
  "Young Adult":         "#26a69a",
  "Self-Help":           "#8bc34a",
  "Self-help":           "#8bc34a",
  // ── Single-word / shorter ──
  "Fantasy":             "#4caf50",
  "Mystery":             "#ef5350",
  "Thriller":            "#ef5350",
  "History":             "#ff9800",
  "Biography":           "#ff7043",
  "Memoir":              "#ff7043",
  "Science":             "#26c6da",
  "Philosophy":          "#b39ddb",
  "Business":            "#ffd54f",
  "Economics":           "#ffd54f",
  "Religion":            "#e0e0e0",
  "Spirituality":        "#e0e0e0",
  "Christian":           "#e0e0e0", // covers "Christianity", "Christian Life", etc.
  "Islamic":             "#e0e0e0",
  "Jewish":              "#e0e0e0",
  "Buddhist":            "#e0e0e0",
  "Poetry":              "#ce93d8",
  "Juvenile":            "#26a69a",
  "Computers":           "#00bcd4",
  "Technology":          "#00bcd4",
  "Psychology":          "#a3e635",
  "Art":                 "#fb7185",
  "Travel":              "#2dd4bf",
  // ── Catch-all for unclassified fiction (must come after all Fiction subtypes) ──
  "Fiction":             "#e8a0bf",
};

const DEFAULT_NODE_COLOR = "#9e9e9e";

// Sort genre keys longest-first so more-specific keys (e.g. "Science Fiction")
// always win over shorter overlapping keys (e.g. "Science").
const SORTED_GENRE_ENTRIES = Object.entries(GENRE_COLORS).sort(
  (a, b) => b[0].length - a[0].length
);

function pickNodeColor(subjects: string[]): string {
  for (const subject of subjects) {
    const lower = subject.toLowerCase();
    for (const [genre, color] of SORTED_GENRE_ENTRIES) {
      if (lower.includes(genre.toLowerCase())) return color;
    }
  }
  return DEFAULT_NODE_COLOR;
}

/** Returns true if at least one subject maps to a known genre color. */
export function hasKnownGenre(subjects: string[]): boolean {
  return pickNodeColor(subjects) !== DEFAULT_NODE_COLOR;
}

// ─── Node sizing ─────────────────────────────────────────────────────────────

/**
 * Log-scale so hubs are prominent without overwhelming isolated nodes.
 * Rating multiplier: unrated books get 0.65×, 5★ books get 1.0×.
 */
export function nodeRadius(degree: number, rating: number | undefined): number {
  const BASE = 7;
  const ratingFactor = rating ? 0.55 + (rating / 5) * 0.45 : 0.65;
  return (BASE + Math.log(1 + degree) * 8) * ratingFactor * 0.75;
}

// ─── Graph builder ───────────────────────────────────────────────────────────

export function buildGraph(books: Book[], edges: AnalyzerEdge[]): GraphData {
  const showLabels = books.length <= LABEL_VISIBILITY_THRESHOLD;

  // Count degree per book
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  const nodes: GraphNode[] = books.map((book) => {
    const deg = degree.get(book.id) ?? 0;
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      val: deg,
      color: pickNodeColor(book.subjects),
      labelVisible: showLabels,
      book,
    };
  });

  const links: GraphLink[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
    weight: e.score,
    sharedSubjects: e.sharedThemes,
    isManual: false,
  }));

  return { nodes, links };
}
