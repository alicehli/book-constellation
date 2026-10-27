import type { Book } from "./types";

/** Lowercase, drop subtitle/series ("Title: Sub", "Title (Series #1)"), strip punctuation */
export function normTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[:(].*/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normAuthor(author: string): string {
  return author.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Identity key used for de-duplicating the same book across imports */
export function bookKey(book: Pick<Book, "title" | "author">): string {
  return `${normTitle(book.title)}||${normAuthor(book.author)}`;
}

export function isRead(book: Book): boolean {
  return book.exclusiveShelf === "read" || (!book.exclusiveShelf && !!book.dateRead);
}
