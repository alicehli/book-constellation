/**
 * Connection engine — TF-IDF scoring (local mode) or Claude-derived edge pairs
 * (claude mode). Switch with setAnalysisMode().
 */

import { stemmer as porterStem } from "stemmer";
import type { Book } from "./types";

const MODE_STORAGE_KEY = "bookgraph-analysis-mode";

let ANALYSIS_MODE: "local" | "claude" = (() => {
  try { return (localStorage.getItem(MODE_STORAGE_KEY) as "local" | "claude") || "local"; }
  catch { return "local"; }
})();

export function setAnalysisMode(mode: "local" | "claude"): void {
  ANALYSIS_MODE = mode;
  try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch {}
}
export function getAnalysisMode(): "local" | "claude" { return ANALYSIS_MODE; }

// ─── Public types ─────────────────────────────────────────────────────────────

export interface BookThemes {
  bookId: string;
  title:  string;
  author: string;
  categoryTokens:    string[];
  descriptionTokens: string[];
  shelfTokens:       string[];
  rating: number;
}

export interface AnalyzerEdge {
  source: string;
  target: string;
  score: number;
  breakdown: {
    tfidfCat:      number;
    tfidfDesc:     number;
    tfidfShelf:    number;
    tfidfEnriched: number; // 1.0 in claude mode, 0 in local mode
    rating:        number;
  };
  sharedThemes: string[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const MIN_SCORE_THRESHOLD = 0.12;
const DESC_FLOOR = 0.05;

const EDGE_CAP_HIGH = 5;
const EDGE_CAP_MID  = 2;
const EDGE_CAP_LOW  = 1;

const WEIGHTS_LOCAL = {
  tfidfCat:   1.0,
  tfidfDesc:  0.7,
  tfidfShelf: 0.5,
  rating:     0.15,
};

export const MAX_SCORE_LOCAL  = 2.35; // 1.0 + 0.7 + 0.5 + 0.15
export const MAX_SCORE_CLAUDE = 1.0;  // flat score per Claude edge
export const MAX_SCORE = MAX_SCORE_LOCAL;

// Stop words for description tokenisation
const DESC_STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","was","are","were","be","been","have","has","had",
  "do","does","did","will","would","could","should","may","might",
  "this","that","these","those","it","its","as","not","no",
  "he","she","they","we","i","you","his","her","their","our","my",
  "who","what","when","where","how","all","about","into","through",
  "also","both","which","more","such","if","there","so","then","them",
  "him","than","one","two","can","said","new","just","like","very",
]);

// Stop words for category token extraction
const CAT_STOP_WORDS = new Set([
  "fiction","nonfiction","non","general","the","a","an","and","or",
  "&","of","in","at","to","for","with","by","from","s","de",
  "literature","literatures",
  "biography","autobiography",
]);

const SUBJECT_NOISE = [
  "bestsell","award","york","times","finalist","recount",
  "nonfiction","publisher","originally","edition","revised","printed",
];

function isCleanSubject(s: string): boolean {
  const lower = s.toLowerCase();
  return s.length <= 40 && !SUBJECT_NOISE.some((n) => lower.includes(n));
}

const GEO_TEMPORAL_DAMPEN_MULTIPLIER = 0.3;
const GEO_TEMPORAL_TOKENS = new Set([
  "china","japan","korea","vietnam","india","pakistan","bangladesh",
  "afghanistan","iran","iraq","rwanda","cambodia","russia","soviet",
  "germany","france","spain","italy","england","britain","ireland",
  "poland","ukraine","israel","egypt","africa","america","mexico",
  "brazil","turkey","greece","sweden","norway","denmark","syria",
  "nigeria","kenya","ethiopia","burma","myanmar","colombia","argentina",
  "berlin","paris","london","tokyo","beijing","shanghai","moscow",
  "jerusalem","auschwitz","saigon","hiroshima","nagasaki","baghdad",
  "kabul","tehran","cairo","istanbul","dublin","warsaw","kyiv",
  "war","wwii","holocaust","colonial","postcolonial","gulag","apartheid",
  "revolution","occupation","resistance",
  "medieval","victorian","ancient","wartime","postwar","century",
  "historical","memoir",
]);

const SHELF_SYSTEM = new Set([
  "read","currently-reading","to-read","owned","owned-books","to-buy",
]);

const SHELF_ORIGIN_NOISE = new Set([
  "canadian-authors", "books-around-the-world", "audiobook", "audiobooks",
  "kindle", "ebook", "e-book", "library-book", "borrowed", "dnf",
  "did-not-finish", "wishlist", "to-buy", "owned", "owned-books",
]);

function isThematicShelf(shelf: string): boolean {
  if (SHELF_SYSTEM.has(shelf)) return false;
  if (SHELF_ORIGIN_NOISE.has(shelf)) return false;
  if (/\b(19|20)\d{2}\b/.test(shelf)) return false;
  if (/favou?rit/i.test(shelf)) return false;
  if (/^(en-|in-)[\w-]+$/.test(shelf)) return false;
  if (/\b(author|around.the.world)\b/i.test(shelf)) return false;
  return true;
}

let _shelfCacheKey = "";
let _shelfCacheMap: Map<string, string[]> = new Map();

async function normalizeShelfNames(shelves: string[]): Promise<Map<string, string[]>> {
  if (shelves.length === 0) return new Map();
  const key = [...shelves].sort().join("|");
  if (key === _shelfCacheKey) return _shelfCacheMap;

  try {
    const res = await fetch("/api/normalize-shelves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shelves }),
    });
    const data = await res.json() as { mapping: Record<string, string[]> };
    _shelfCacheMap = new Map(Object.entries(data.mapping));
    _shelfCacheKey = key;
  } catch (err) {
    console.warn("Shelf normalisation unavailable, shelfTokens will be empty:", err);
    _shelfCacheMap = new Map();
    _shelfCacheKey = key;
  }

  return _shelfCacheMap;
}

// ─── Claude edge cache ────────────────────────────────────────────────────────

export interface ClaudeRawEdge {
  a: string;
  b: string;
  themes: string[];
}

const CLAUDE_EDGES_KEY = "bookgraph-claude-edges:";

function libraryHash(titles: string[]): string {
  const str = [...titles].sort().join("|");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function readEdgeCache(hash: string): ClaudeRawEdge[] | null {
  try {
    const raw = localStorage.getItem(CLAUDE_EDGES_KEY + hash);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function writeEdgeCache(hash: string, edges: ClaudeRawEdge[]): void {
  try { localStorage.setItem(CLAUDE_EDGES_KEY + hash, JSON.stringify(edges)); }
  catch { /* localStorage full or unavailable */ }
}

export function clearClaudeEdgeCache(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CLAUDE_EDGES_KEY)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch { /* unavailable */ }
}

// ─── Claude edge fetching ─────────────────────────────────────────────────────

// Deduplicates concurrent requests for the same library hash
const _inFlight = new Map<string, Promise<ClaudeRawEdge[]>>();

async function fetchClaudeEdges(themes: BookThemes[]): Promise<ClaudeRawEdge[]> {
  const hash = libraryHash(themes.map((t) => t.title));
  const cached = readEdgeCache(hash);
  if (cached !== null) {
    console.log(`Claude edges: ${cached.length} from cache`);
    return cached;
  }

  if (_inFlight.has(hash)) {
    console.log("Claude edges: joining in-flight request");
    return _inFlight.get(hash)!;
  }

  const books = themes.map((t) => ({ title: t.title, author: t.author }));
  console.log(`Claude edges: sending ${books.length} books`);

  const request = (async () => {
    try {
      const res = await fetch("/api/analyze-library", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ books }),
      });
      const data = await res.json() as { edges?: ClaudeRawEdge[] };
      const allEdges = data.edges ?? [];
      if (allEdges.length > 0) writeEdgeCache(hash, allEdges);
      console.log(`Claude edges: ${allEdges.length} from API`);
      return allEdges;
    } catch (err) {
      console.warn("Claude edges fetch failed:", err);
      return [];
    } finally {
      _inFlight.delete(hash);
    }
  })();

  _inFlight.set(hash, request);
  return request;
}

async function buildClaudeEdges(themes: BookThemes[]): Promise<AnalyzerEdge[]> {
  const rawEdges = await fetchClaudeEdges(themes);

  // Claude receives books as "Title by Author" and echoes that format back.
  // Strip the " by <author>" suffix before matching.
  function stripAuthor(s: string): string {
    const idx = s.indexOf(" by ");
    return idx > 0 ? s.slice(0, idx).trim() : s;
  }

  // Normalize for matching: lowercase, drop subtitle/series, strip leading articles
  function normForMatch(s: string): string {
    return normTitle(s).replace(/^(the|a|an) /, "");
  }

  // Build lookup maps
  const byNormTitle    = new Map<string, string>(); // normTitle(title)   → id
  const byNormNoArt    = new Map<string, string>(); // normForMatch(title) → id
  for (const t of themes) {
    byNormTitle.set(normTitle(t.title), t.bookId);
    byNormNoArt.set(normForMatch(t.title), t.bookId);
  }

  function resolveId(raw: string): string | undefined {
    // Pass 1: exact normTitle (handles Claude returning title-only)
    let id = byNormTitle.get(normTitle(raw));
    if (id) return id;

    // Pass 2: strip "by Author" suffix, then normTitle
    const titleOnly = stripAuthor(raw);
    id = byNormTitle.get(normTitle(titleOnly));
    if (id) return id;

    // Pass 3: also strip leading articles
    id = byNormNoArt.get(normForMatch(titleOnly));
    if (id) return id;

    // Pass 4: fuzzy includes — one normalised title contains the other
    const norm = normTitle(titleOnly);
    if (norm.length >= 8) {
      for (const [known, knownId] of byNormTitle) {
        if (known.length >= 8 && (known.includes(norm) || norm.includes(known))) {
          return knownId;
        }
      }
    }

    return undefined;
  }

  const edgeCount = new Map<string, number>();
  const seenPairs = new Set<string>();
  const MAX_PER_BOOK = 5;
  const edges: AnalyzerEdge[] = [];
  let nMatched = 0, nFailed = 0;
  const failedSamples: string[] = [];

  for (const raw of rawEdges) {
    const srcId = resolveId(raw.a);
    const tgtId = resolveId(raw.b);

    if (!srcId || !tgtId) {
      nFailed++;
      if (failedSamples.length < 5) {
        failedSamples.push(!srcId ? `a: "${raw.a}"` : `b: "${raw.b}"`);
      }
      continue;
    }
    if (srcId === tgtId) continue;

    const pairKey = srcId < tgtId ? `${srcId}|||${tgtId}` : `${tgtId}|||${srcId}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const srcCount = edgeCount.get(srcId) ?? 0;
    const tgtCount = edgeCount.get(tgtId) ?? 0;
    if (srcCount >= MAX_PER_BOOK || tgtCount >= MAX_PER_BOOK) continue;

    edgeCount.set(srcId, srcCount + 1);
    edgeCount.set(tgtId, tgtCount + 1);
    nMatched++;

    edges.push({
      source: srcId,
      target: tgtId,
      score: 1.0,
      breakdown: { tfidfCat: 0, tfidfDesc: 0, tfidfShelf: 0, tfidfEnriched: 1.0, rating: 0 },
      sharedThemes: raw.themes.slice(0, 5),
    });
  }

  console.log(`Claude edges: ${nMatched} matched, ${nFailed} failed out of ${rawEdges.length} raw`);
  if (failedSamples.length > 0) console.log("Failed samples:", failedSamples);

  return edges;
}

// ─── Stemmer ─────────────────────────────────────────────────────────────────

function stem(word: string): string {
  return word.length <= 4 ? word : porterStem(word);
}

// ─── Tokenisers ──────────────────────────────────────────────────────────────

const DESC_PROMO_PATTERNS = [
  "bestselling", "bestseller", "best-selling", "best seller",
  "award-winning", "award winning", "prize-winning",
  "critically acclaimed", "critical acclaim",
  "tour de force", "must-read", "must read", "page-turner", "page turner",
  "tour de force", "magnum opus", "chef-d'oeuvre",
  "kirkus", "publishers weekly", "library journal", "booklist",
  "bookpage", "school library journal",
  "new york times", "washington post", "the guardian", "the atlantic",
  "new yorker", "entertainment weekly", "people magazine",
  "npr books", "time magazine",
  "national book award", "pulitzer prize", "booker prize",
  "man booker", "costa award", "women's prize",
  "oprah's book club", "reese's book club",
];

function stripPromoSentences(text: string): string {
  return text
    .split(/[.!?]+\s+/)
    .filter((sentence) => {
      const lower = sentence.toLowerCase();
      return !DESC_PROMO_PATTERNS.some((p) => lower.includes(p));
    })
    .join(" ");
}

function tokeniseDescription(text: string): string[] {
  if (!text) return [];
  return stripPromoSentences(text)
    .toLowerCase()
    .replace(/\b\d{4}s?\b/g, " ")
    .replace(/\b\d{1,2}(st|nd|rd|th)[\s-]+centur\w*/gi, " ")
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !DESC_STOP_WORDS.has(w))
    .map(stem);
}

function tokeniseCategories(subjects: string[]): string[] {
  const tokens: string[] = [];
  for (const s of subjects.filter(isCleanSubject)) {
    const parts = s
      .toLowerCase()
      .split(/[\s/,&()\-.:'"+]+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ""))
      .filter((w) =>
        w.length > 2 &&
        w.length <= 15 &&
        !CAT_STOP_WORDS.has(w) &&
        !/^\d/.test(w)
      );
    tokens.push(...parts);
  }
  return [...new Set(tokens)];
}

// ─── Math primitives ─────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── TF-IDF ──────────────────────────────────────────────────────────────────

function buildTfIdfVectors(
  themes: BookThemes[],
  getTokens: (t: BookThemes) => string[],
  dampenGeo = false,
  minIdf = 0,
): number[][] {
  const N = themes.length;
  const tokenLists = themes.map(getTokens);

  const vocab = new Map<string, number>();
  for (const tokens of tokenLists) {
    for (const token of tokens) {
      if (!vocab.has(token)) vocab.set(token, vocab.size);
    }
  }
  const V = vocab.size;
  if (V === 0) return themes.map(() => []);

  const df = new Float64Array(V);
  for (const tokens of tokenLists) {
    const seen = new Set<number>();
    for (const token of tokens) {
      const idx = vocab.get(token)!;
      if (!seen.has(idx)) { df[idx]++; seen.add(idx); }
    }
  }

  const idf = Array.from(df, (d) => Math.max(Math.log(N / (1 + d)), minIdf));

  if (dampenGeo) {
    for (const [token, idx] of vocab) {
      if (GEO_TEMPORAL_TOKENS.has(token)) idf[idx] *= GEO_TEMPORAL_DAMPEN_MULTIPLIER;
    }
  }

  return tokenLists.map((tokens) => {
    const vec = new Array<number>(V).fill(0);
    for (const token of tokens) {
      const idx = vocab.get(token)!;
      vec[idx] = idf[idx];
    }
    return vec;
  });
}

// ─── Deduplication ───────────────────────────────────────────────────────────

function normTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[:(].*/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normAuthor(author: string): string {
  return author.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function deduplicateBooks(books: Book[]): Book[] {
  const groups = new Map<string, Book[]>();
  for (const book of books) {
    const key = `${normTitle(book.title)}||${normAuthor(book.author)}`;
    const group = groups.get(key) ?? [];
    group.push(book);
    groups.set(key, group);
  }

  const result: Book[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    const best = group.reduce((a, b) => {
      const isRead = (x: Book) => x.exclusiveShelf === "read" || (!x.exclusiveShelf && !!x.dateRead);
      const score = (x: Book) =>
        (isRead(x) ? 10 : 0) +
        (x.review ? 4 : 0) +
        x.shelves.length +
        (x.rating ?? 0) +
        x.subjects.length;
      return score(b) > score(a) ? b : a;
    });
    result.push(best);
  }
  return result;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function analyzeBooks(rawBooks: Book[]): Promise<BookThemes[]> {
  const deduped = deduplicateBooks(rawBooks);
  // Claude mode only analyzes read books — keeps the payload small and focused
  const books = ANALYSIS_MODE === "claude"
    ? deduped.filter((b) => b.exclusiveShelf === "read" || (!b.exclusiveShelf && !!b.dateRead))
    : deduped;

  let shelfMapping = new Map<string, string[]>();

  if (ANALYSIS_MODE === "local") {
    const allShelves = new Set<string>();
    for (const book of books) {
      for (const raw of book.shelves) {
        const s = raw.trim().toLowerCase();
        if (s.length > 1 && isThematicShelf(s)) allShelves.add(s);
      }
    }
    shelfMapping = await normalizeShelfNames([...allShelves]);
  }

  return books.map((book) => {
    const shelfTokens = ANALYSIS_MODE === "local"
      ? [
          ...new Set(
            book.shelves
              .map((s) => s.trim().toLowerCase())
              .filter((s) => shelfMapping.has(s))
              .flatMap((s) => shelfMapping.get(s)!)
          ),
        ]
      : [];

    return {
      bookId: book.id,
      title:  book.title,
      author: book.author,
      categoryTokens:    tokeniseCategories(book.subjects),
      descriptionTokens: tokeniseDescription(book.description ?? ""),
      shelfTokens,
      rating: book.rating ?? 0,
    };
  });
}

/**
 * Build edges from pre-computed themes.
 *
 * Claude mode: fetches/caches library-level edge pairs from the API, skips TF-IDF.
 * Local mode: TF-IDF cosine similarity on subjects, descriptions, and shelf tokens.
 */
export async function buildEdges(themes: BookThemes[]): Promise<AnalyzerEdge[]> {
  if (themes.length < 2) return [];

  if (ANALYSIS_MODE === "claude") return buildClaudeEdges(themes);

  // Local mode ─ TF-IDF pipeline
  const W = WEIGHTS_LOCAL;
  const maxScore = MAX_SCORE_LOCAL;

  const catVecs   = buildTfIdfVectors(themes, (t) => t.categoryTokens,    true,  0);
  const descVecs  = buildTfIdfVectors(themes, (t) => t.descriptionTokens, false, 0);
  const shelfVecs = buildTfIdfVectors(themes, (t) => t.shelfTokens,       false, 0);

  const candidates: (AnalyzerEdge & { _key: string })[] = [];
  const n = themes.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = themes[i];
      const b = themes[j];

      const tfidfCat   = cosineSimilarity(catVecs[i],   catVecs[j]);
      const tfidfDesc  = cosineSimilarity(descVecs[i],  descVecs[j]);
      const tfidfShelf = cosineSimilarity(shelfVecs[i], shelfVecs[j]);

      const ratingScore = (a.rating > 0 && b.rating > 0)
        ? Math.sqrt(a.rating * b.rating) / 5
        : 0;
      const ratingBoost = (tfidfCat >= 0.12 && tfidfDesc >= 0.08)
        ? ratingScore * W.rating
        : 0;

      const score =
        tfidfCat   * W.tfidfCat   +
        tfidfDesc  * W.tfidfDesc  +
        tfidfShelf * W.tfidfShelf +
        ratingBoost;

      const hasDesc = a.descriptionTokens.length > 0 && b.descriptionTokens.length > 0;
      if (hasDesc && tfidfDesc < DESC_FLOOR && tfidfShelf < 0.3) continue;

      if (score < MIN_SCORE_THRESHOLD) continue;

      const sharedThemes: string[] = [];
      const sharedCatTokens   = a.categoryTokens.filter((t) => b.categoryTokens.includes(t));
      const sharedShelfTokens = a.shelfTokens.filter((t) => b.shelfTokens.includes(t));
      if (sharedCatTokens.length > 0) {
        sharedThemes.push(...sharedCatTokens.slice(0, 3));
      } else if (sharedShelfTokens.length > 0) {
        sharedThemes.push(...sharedShelfTokens.slice(0, 3));
      } else if (tfidfCat >= 0.15) {
        sharedThemes.push("similar themes");
      } else if (ratingBoost > 0) {
        sharedThemes.push("both highly rated");
      } else {
        sharedThemes.push("weak match");
      }

      candidates.push({
        source: a.bookId,
        target: b.bookId,
        score,
        breakdown: {
          tfidfCat,
          tfidfDesc,
          tfidfShelf,
          tfidfEnriched: 0,
          rating: ratingBoost,
        },
        sharedThemes,
        _key: `${a.bookId}||${b.bookId}`,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const TIER_HIGH = maxScore * 0.30;
  const TIER_MID  = maxScore * 0.20;

  type TierCounts = { high: number; mid: number; low: number };
  const tierCount = new Map<string, TierCounts>();
  const nodeTier = (id: string): TierCounts => {
    if (!tierCount.has(id)) tierCount.set(id, { high: 0, mid: 0, low: 0 });
    return tierCount.get(id)!;
  };

  const finalEdges: AnalyzerEdge[] = [];

  for (const c of candidates) {
    const src = nodeTier(c.source);
    const tgt = nodeTier(c.target);

    let band: keyof TierCounts;
    let cap: number;
    if (c.score > TIER_HIGH) {
      band = "high"; cap = EDGE_CAP_HIGH;
    } else if (c.score > TIER_MID) {
      band = "mid"; cap = EDGE_CAP_MID;
    } else {
      band = "low"; cap = EDGE_CAP_LOW;
    }

    if (src[band] >= cap || tgt[band] >= cap) continue;

    src[band]++;
    tgt[band]++;

    const { _key: _, ...edge } = c;
    finalEdges.push(edge);
  }

  return finalEdges;
}
