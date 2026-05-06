import { Book } from "./types";

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

export function mergeBooks(existing: Book[], incoming: Book[]): Book[] {
  const seen = new Set(
    existing.map((b) => `${normTitle(b.title)}||${normAuthor(b.author)}`)
  );
  const novel = incoming.filter(
    (b) => !seen.has(`${normTitle(b.title)}||${normAuthor(b.author)}`)
  );
  return [...existing, ...novel];
}
