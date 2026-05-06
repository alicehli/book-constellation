/**
 * Harness for verifying the scoring pipeline against 10 known books.
 *
 * Run from the browser: import and call runHarness(), or visit /debug.
 * Expected behaviour:
 *  - Hosseini pair (Kite Runner + Splendid Suns) should score highest — same
 *    author shelf, Afghanistan tokens, similar descriptions, both 5★
 *  - Historical fiction cluster (Pillars + Name of Rose + All the Light) should
 *    connect via 'historical', 'medieval'/'war' tokens
 *  - Self-help cluster (Atomic Habits + Deep Work) should connect via 'habit',
 *    'productiv', 'work' description tokens
 *  - Isolated book (Moby Dick) should have 0 or 1 edge max
 */

import { analyzeBooks, buildEdges, MAX_SCORE } from "./analyzer";
import type { Book } from "./types";

const HARNESS_BOOKS: Book[] = [
  {
    id: "h1", title: "The Kite Runner", author: "Hosseini, Khaled",
    subjects: ["Fiction", "Afghanistan", "Fathers and sons", "Historical Fiction"],
    description: "A story of friendship and betrayal set against the backdrop of a turbulent Afghanistan. Amir and Hassan grow up together but a single act of cowardice haunts Amir for decades.",
    shelves: ["favorites", "literary-fiction", "afghanistan"],
    rating: 5, enriched: true,
  },
  {
    id: "h2", title: "A Thousand Splendid Suns", author: "Hosseini, Khaled",
    subjects: ["Fiction", "Afghanistan", "Women", "Historical Fiction"],
    description: "Two women in war-torn Afghanistan endure hardship and forge an unlikely bond. A story of resilience, friendship, and the bonds of womanhood under oppression.",
    shelves: ["favorites", "literary-fiction", "afghanistan"],
    rating: 5, enriched: true,
  },
  {
    id: "h3", title: "The Pillars of the Earth", author: "Follett, Ken",
    subjects: ["Fiction", "Historical Fiction", "Medieval", "Architecture"],
    description: "The building of a cathedral in twelfth-century England, set against war, politics, and religious conflict. An epic of ambition and survival in medieval times.",
    shelves: ["historical-fiction", "epics"],
    rating: 4, enriched: true,
  },
  {
    id: "h4", title: "The Name of the Rose", author: "Eco, Umberto",
    subjects: ["Fiction", "Historical Fiction", "Medieval", "Mystery", "Italy"],
    description: "A medieval monk investigates a series of murders in an Italian monastery. Philosophy, heresy, and forbidden knowledge intertwine in this labyrinthine mystery.",
    shelves: ["historical-fiction", "mystery"],
    rating: 4, enriched: true,
  },
  {
    id: "h5", title: "All the Light We Cannot See", author: "Doerr, Anthony",
    subjects: ["Fiction", "Historical Fiction", "World War II", "France"],
    description: "A blind French girl and a German soldier's paths converge in occupied France during World War II. A story of survival, wonder, and the cost of war.",
    shelves: ["historical-fiction", "favorites", "ww2"],
    rating: 5, enriched: true,
  },
  {
    id: "h6", title: "The Nightingale", author: "Hannah, Kristin",
    subjects: ["Fiction", "Historical Fiction", "World War II", "France", "Women"],
    description: "Two sisters in German-occupied France during World War II discover what they are capable of. A story of resistance, love, and survival against impossible odds.",
    shelves: ["historical-fiction", "ww2", "favorites"],
    rating: 5, enriched: true,
  },
  {
    id: "h7", title: "Atomic Habits", author: "Clear, James",
    subjects: ["Self-Help", "Psychology", "Productivity", "Behavior"],
    description: "A proven framework for improving every day using tiny changes. How habits compound over time and the science of behavior change and productivity.",
    shelves: ["self-help", "productivity"],
    rating: 4, enriched: true,
  },
  {
    id: "h8", title: "Deep Work", author: "Newport, Cal",
    subjects: ["Self-Help", "Productivity", "Business", "Psychology"],
    description: "The ability to focus without distraction on cognitively demanding tasks. Rules for focused success in a distracted world and the value of deep productive work.",
    shelves: ["self-help", "productivity"],
    rating: 4, enriched: true,
  },
  {
    id: "h9", title: "Sapiens", author: "Harari, Yuval Noah",
    subjects: ["History", "Anthropology", "Science", "Evolution"],
    description: "A brief history of humankind from the Stone Age to the present. How biology and history shaped the human animal and the societies we live in.",
    shelves: ["nonfiction", "history"],
    rating: 4, enriched: true,
  },
  {
    id: "h10", title: "Moby Dick", author: "Melville, Herman",
    subjects: ["Fiction", "Adventure", "Sea stories", "Whaling"],
    description: "Captain Ahab pursues the white whale across the ocean in an obsessive quest. A philosophical meditation on fate, obsession, and the sea.",
    shelves: ["classics"],
    rating: 3, enriched: true,
  },
];

export interface HarnessResult {
  summary: string;
  edges: Array<{
    from: string;
    to: string;
    score: number;
    pct: string;
    themes: string[];
    breakdown: { tfidfCat: string; tfidfDesc: string; tfidfShelf: string; rating: string };
  }>;
  degrees: Array<{ title: string; degree: number }>;
}

export async function runHarness(): Promise<HarnessResult> {
  const themes = await analyzeBooks(HARNESS_BOOKS);
  const edges  = await buildEdges(themes);
  const titleOf = new Map(HARNESS_BOOKS.map((b) => [b.id, b.title]));

  const sorted = [...edges].sort((a, b) => b.score - a.score);

  const deg = new Map<string, number>();
  for (const e of edges) {
    deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
    deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
  }

  return {
    summary: `${HARNESS_BOOKS.length} books → ${edges.length} edges`,
    edges: sorted.map((e) => ({
      from: titleOf.get(e.source) ?? e.source,
      to:   titleOf.get(e.target) ?? e.target,
      score: e.score,
      // Normalise to 0–100% by dividing by MAX_SCORE (theoretical max = 1.8)
      pct: ((e.score / MAX_SCORE) * 100).toFixed(0) + "%",
      themes: e.sharedThemes,
      breakdown: {
        tfidfCat:   e.breakdown.tfidfCat.toFixed(3),
        tfidfDesc:  e.breakdown.tfidfDesc.toFixed(3),
        tfidfShelf: e.breakdown.tfidfShelf.toFixed(3),
        rating:     e.breakdown.rating.toFixed(3),
      },
    })),
    degrees: HARNESS_BOOKS.map((b) => ({
      title: b.title,
      degree: deg.get(b.id) ?? 0,
    })),
  };
}
