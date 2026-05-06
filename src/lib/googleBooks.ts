import { Book, GoogleBooksCandidate } from "./types";
import { nanoid } from "./nanoid";

const BASE_URL = "https://www.googleapis.com/books/v1";

function getApiKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY ?? null;
}

function buildQuery(params: Record<string, string>): string {
  const key = getApiKey();
  const q = new URLSearchParams(params);
  if (key) q.set("key", key);
  return q.toString();
}

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
  };
}

export async function searchGoogleBooks(
  query: string,
  maxResults = 5
): Promise<GoogleBooksCandidate[]> {
  const qs = buildQuery({ q: query, maxResults: String(maxResults) });
  const res = await fetch(`${BASE_URL}/volumes?${qs}`);
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map(parseVolumeInfo);
}

// Search via the server-side proxy (avoids CORS / referrer restrictions)
async function proxySearch(q: string, maxResults = 5): Promise<GoogleBooksCandidate[]> {
  try {
    const params = new URLSearchParams({ q, maxResults: String(maxResults) });
    const res = await fetch(`/api/search-books?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map(parseVolumeInfo);
  } catch {
    return [];
  }
}

// Pick the best candidate: prefer any result that has subjects over one that doesn't
function bestOf(candidates: GoogleBooksCandidate[]): GoogleBooksCandidate | null {
  if (candidates.length === 0) return null;
  return candidates.find((c) => c.subjects.length > 0) ?? candidates[0];
}

// Fetch a single best match by title + author (used during CSV enrichment)
export async function enrichBook(
  title: string,
  author: string
): Promise<Partial<Book>> {
  // Pass 1: specific search with author
  const q1 = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`;
  let best = bestOf(await proxySearch(q1));

  // Pass 2: title-only if the specific result had no subjects
  if (author && (!best || best.subjects.length === 0)) {
    const fallback = bestOf(await proxySearch(`intitle:${title}`));
    if (fallback && fallback.subjects.length > (best?.subjects.length ?? 0)) {
      best = fallback;
    }
  }

  if (!best) return {};
  return {
    subjects: best.subjects,
    coverUrl: best.coverUrl ?? undefined,
    description: best.description,
    publishedYear: best.publishedYear,
    googleBooksId: best.googleBooksId,
    enriched: true,
  };
}

// Rate-limited batch enrichment with progress callbacks
export async function enrichBooks(
  books: Book[],
  onProgress: (current: number, title: string) => void,
  delayMs = 200 // ~5 req/sec, well within free tier limits
): Promise<Book[]> {
  const enriched: Book[] = [];

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    onProgress(i + 1, book.title);
    const extra = await enrichBook(book.title, book.author);
    enriched.push({ ...book, ...extra, enriched: true });
    if (i < books.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return enriched;
}

// Search for plain-text title matches via server-side proxy (avoids CORS / key restrictions)
export async function findCandidates(
  title: string
): Promise<GoogleBooksCandidate[]> {
  const params = new URLSearchParams({ q: `intitle:${title}`, maxResults: "5" });
  const res = await fetch(`/api/search-books?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map(parseVolumeInfo);
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
