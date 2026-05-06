import Papa from "papaparse";
import { Book, RawGoodreadsRow } from "./types";
import { nanoid } from "./nanoid";

export function parseGoodreadsCSV(csvText: string): Book[] {
  const result = Papa.parse<RawGoodreadsRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  return result.data
    .filter((row) => row.Title?.trim())
    .map((row) => {
      const shelvesRaw = row["Bookshelves"] ?? "";
      const shelves = shelvesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const rating = parseInt(row["My Rating"] ?? "0", 10);
      const exclusiveShelf = row["Exclusive Shelf"]?.trim() || undefined;

      return {
        id: nanoid(),
        title: row["Title"].trim(),
        author: row["Author"]?.trim() ?? "",
        rating: rating > 0 ? rating : undefined,
        dateRead: row["Date Read"]?.trim() || undefined,
        shelves,
        exclusiveShelf,
        review: row["My Review"]?.trim() || undefined,
        subjects: [],
        enriched: false,
      } satisfies Book;
    });
}

export function parsePlainText(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
