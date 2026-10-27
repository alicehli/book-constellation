import { Book, GoogleBooksCandidate } from "./types";
import { hasKnownGenre } from "./buildGraph";
import { nanoid } from "./nanoid";
import { normAuthor, normTitle } from "./normalize";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseVolumeInfo(item: any): GoogleBooksCandidate {
  const info = item.volumeInfo ?? {};
  const imageLinks = info.imageLinks ?? {};
  const coverUrl: string | undefined =
    imageLinks.thumbnail?.replace("http://", "https://") ??
    imageLinks.smallThumbnail?.replace("http://", "https://");

  const subjects: string[] = [
    ...(info.categories ?? []),
    ...(info.mainCategory ? [info.mainCategory] : []),
  ]
    .flatMap((c: string) => c.split(/[/,]/))
    .map((c: string) => c.trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 8);

  const publishedYear = info.publishedDate
    ? parseInt(info.publishedDate.slice(0, 4), 10)
    : undefined;

  return {
    googleBooksId: item.id,
    title: info.title ?? "",
    author: (info.authors ?? []).join(", "),
    coverUrl,
    description: info.description
      ? info.description.length > 500
        ? info.description.slice(0, 497) + "…"
        : info.description
      : undefined,
    subjects,
    publishedYear,
    pageCount: info.pageCount ?? undefined,
  };
}

// Fetch a single volume by ID — returns richer category data than search results
async function proxyFetchVolume(googleBooksId: string): Promise<GoogleBooksCandidate | null> {
  try {
    const res = await fetch(`/api/search-books?volumeId=${encodeURIComponent(googleBooksId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.volumeInfo) return null;
    return parseVolumeInfo(data);
  } catch {
    return null;
  }
}

// Search via the server-side proxy (avoids CORS / referrer restrictions).
// Throws on network/upstream failure so callers can distinguish it from "no results".
async function proxySearch(q: string, maxResults = 5): Promise<GoogleBooksCandidate[]> {
  const params = new URLSearchParams({ q, maxResults: String(maxResults) });
  const res = await fetch(`/api/search-books?${params}`);
  if (!res.ok) throw new Error(`Book search failed (${res.status})`);
  const data = await res.json();
  return (data.items ?? []).map(parseVolumeInfo);
}

// "Hosseini, Khaled" → "Khaled Hosseini". Goodreads' Author column is already
// "First Last", so only flip a genuine "Last, First" — never "King, Jr.".
function normalizeAuthor(author: string): string {
  const parts = author.split(",").map((s) => s.trim());
  if (parts.length !== 2 || /^(jr|sr|ii|iii|iv|phd|md)\.?$/i.test(parts[1])) return author;
  return `${parts[1]} ${parts[0]}`;
}

// Drop Goodreads series suffixes, which Google Books titles don't carry:
// "Dune (Dune, #1)" → "Dune"
function searchTitle(title: string): string {
  return title.replace(/\s*\([^()]*#\d+(\.\d+)?\)\s*$/, "").trim() || title;
}

// Score how well a candidate matches the searched title + author.
// Returns 0–1; used to break ties when multiple results have subjects/genres.
function matchScore(c: GoogleBooksCandidate, title: string, author: string): number {
  const ct = normTitle(c.title);
  const st = normTitle(title);
  const ca = normAuthor(c.author);
  const sa = normAuthor(author);

  const titleMatch = ct === st ? 1 : (ct.includes(st) || st.includes(ct)) ? 0.6 : 0;
  const authorMatch = sa && ca.split(" ").some((w) => w.length > 2 && sa.includes(w)) ? 1 : 0;

  return titleMatch * 0.7 + authorMatch * 0.3;
}

// Phrases that identify a secondary work derived from an existing book.
// Deliberately specific — "graphic novel" alone would wrongly flag Persepolis,
// Maus, etc. which are original works in the medium.
const ADAPTATION_PHRASES = [
  "graphic novel interpretation",
  "graphic novel adaptation",
  "graphic novel version",
  "illustrated adaptation",
  "adapted from",
  "based on the novel",
  "manga adaptation",
  "comic adaptation",
];

function isAdaptation(c: GoogleBooksCandidate): boolean {
  const combined = `${c.title} ${c.description ?? ""}`.toLowerCase();
  const titleSuffix = /\bgraphic novel\b/.test(c.title.toLowerCase());
  // A "Comics & Graphic Novels" subject on a result whose title matches a prose book
  // means it's an adapted edition (e.g. Lord of the Flies graphic novel).
  // Note: for original graphic works (Persepolis, Maus) ALL candidates will have this
  // subject, so originals[] will be empty and bestOf() correctly falls back to the full pool.
  const comicsSubject = c.subjects.some((s) => /comic|graphic novel/i.test(s));
  return titleSuffix || comicsSubject || ADAPTATION_PHRASES.some((p) => combined.includes(p));
}

// Pick the best candidate: title/author similarity gates the result,
// then prefer recognized genre > any subjects > highest similarity.
// Adaptations (graphic novels, manga) are deprioritized but kept as fallback.
function bestOf(
  candidates: GoogleBooksCandidate[],
  title = "",
  author = "",
): GoogleBooksCandidate | null {
  if (candidates.length === 0) return null;

  // Require at least a partial title match to avoid confidently wrong results
  const plausible = candidates.filter((c) => matchScore(c, title, author) > 0);
  const pool = plausible.length > 0 ? plausible : candidates;

  // Prefer original works over adaptations; fall back to adaptations if nothing else
  const originals = pool.filter((c) => !isAdaptation(c));
  const ranked = originals.length > 0 ? originals : pool;

  // Sort by: known genre > has subjects > match score, with page count as final tiebreaker
  const scored = ranked.map((c) => ({ c, score: matchScore(c, title, author) }));
  const withGenre = scored.filter(({ c }) => hasKnownGenre(c.subjects));
  if (withGenre.length > 0) return withGenre.sort((a, b) => b.score - a.score)[0].c;
  const withSubjects = scored.filter(({ c }) => c.subjects.length > 0);
  if (withSubjects.length > 0) return withSubjects.sort((a, b) => b.score - a.score || (b.c.pageCount ?? 0) - (a.c.pageCount ?? 0))[0].c;
  return scored.sort((a, b) => b.score - a.score || (b.c.pageCount ?? 0) - (a.c.pageCount ?? 0))[0].c;
}

// Fetch a single best match by title + author (used during CSV enrichment)
export async function enrichBook(
  title: string,
  author: string
): Promise<Partial<Book>> {
  const normalizedAuthor = normalizeAuthor(author);
  const t = searchTitle(title);
  // Pass 1: specific search with normalized author
  const q1 = normalizedAuthor
    ? `intitle:${t} inauthor:${normalizedAuthor}`
    : `intitle:${t}`;
  let best = bestOf(await proxySearch(q1), t, normalizedAuthor);

  // Pass 2: title-only fallback if Pass 1 returned no subjects
  if (normalizedAuthor && (!best || best.subjects.length === 0)) {
    const fallback = bestOf(await proxySearch(`intitle:${t}`), t, normalizedAuthor);
    if (fallback && fallback.subjects.length > (best?.subjects.length ?? 0)) {
      best = fallback;
    }
  }

  if (!best) return {};

  // Search results return sparse categories; the full volume endpoint has richer data
  if (best.subjects.length <= 1) {
    const full = await proxyFetchVolume(best.googleBooksId);
    if (full && full.subjects.length > best.subjects.length) {
      best = { ...best, subjects: full.subjects, description: full.description ?? best.description };
    }
  }

  return {
    subjects: best.subjects,
    coverUrl: best.coverUrl ?? undefined,
    description: best.description,
    publishedYear: best.publishedYear,
    googleBooksId: best.googleBooksId,
    enriched: true,
  };
}

// Rate-limited batch enrichment with progress callbacks. A book whose lookup failed
// (network error, rate limit) is returned unchanged with enriched: false so it's retried later.
export async function enrichBooks(
  books: Book[],
  onProgress: (current: number, title: string) => void,
  delayMs = 200 // ~5 req/sec, well within free tier limits
): Promise<Book[]> {
  const enriched: Book[] = [];

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    onProgress(i + 1, book.title);
    try {
      const extra = await enrichBook(book.title, book.author);
      enriched.push({ ...book, ...extra, enriched: true });
    } catch (err) {
      console.warn(`Enrichment failed for "${book.title}":`, err);
      enriched.push({ ...book, enriched: false });
    }
    if (i < books.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return enriched;
}

// Search for plain-text title matches (used by the "Type titles" import)
export function findCandidates(title: string): Promise<GoogleBooksCandidate[]> {
  return proxySearch(`intitle:${searchTitle(title)}`);
}

export function candidateToBook(c: GoogleBooksCandidate): Book {
  return {
    id: nanoid(),
    title: c.title,
    author: c.author,
    shelves: [],
    subjects: c.subjects,
    coverUrl: c.coverUrl,
    description: c.description,
    publishedYear: c.publishedYear,
    googleBooksId: c.googleBooksId,
    enriched: true,
  };
}
