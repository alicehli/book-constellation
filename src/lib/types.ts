export interface Book {
  id: string;
  title: string;
  author: string;
  rating?: number; // 1–5 from Goodreads
  dateRead?: string;
  shelves: string[];
  exclusiveShelf?: "read" | "currently-reading" | "to-read" | string;
  review?: string;
  // Google Books enrichment
  subjects: string[];
  coverUrl?: string;
  publishedYear?: number;
  description?: string;
  googleBooksId?: string;
  enriched: boolean;
}

export interface GraphFilters {
  minRating: number; // 0 = any
}

export interface RawGoodreadsRow {
  Title: string;
  Author: string;
  "My Rating": string;
  "Date Read": string;
  Bookshelves: string;
  "My Review": string;
  [key: string]: string;
}

export interface GoogleBooksCandidate {
  googleBooksId: string;
  title: string;
  author: string;
  coverUrl?: string;
  description?: string;
  subjects: string[];
  publishedYear?: number;
}

// Graph types (shaped for react-force-graph-2d)
export interface GraphNode {
  id: string;
  title: string;
  author: string;
  val: number; // node size = connection count (min 1)
  color: string;
  labelVisible: boolean;
  book: Book;
  // force-graph internals (populated at runtime)
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number; // number of shared subjects
  sharedSubjects: string[];
  isManual: boolean; // V2: user-created links
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export type ImportMethod = "csv" | "text";

export interface EnrichmentProgress {
  total: number;
  current: number;
  currentTitle: string;
  done: boolean;
}
