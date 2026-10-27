import { Book } from "./types";
import { bookKey } from "./normalize";

const STORAGE_KEY = "bookgraph_library";

export function saveBooks(books: Book[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch {
    console.warn("localStorage write failed — storage may be full");
  }
}

export function loadBooks(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Book[];
  } catch {
    return [];
  }
}

/** Books from `incoming` not already in `existing` (or earlier in `incoming`), by title + author */
export function novelBooks(existing: Book[], incoming: Book[]): Book[] {
  const seen = new Set(existing.map(bookKey));
  return incoming.filter((b) => {
    const key = bookKey(b);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
