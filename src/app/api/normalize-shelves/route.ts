import { NextRequest, NextResponse } from "next/server";
import { extractJson } from "@/lib/extractJson";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ mapping: {} });
  }

  const { shelves } = (await req.json()) as { shelves: string[] };
  if (!shelves?.length) {
    return NextResponse.json({ mapping: {} });
  }

  const prompt = `Map each Goodreads shelf name to 1–3 lowercase thematic tags for book similarity analysis.

Rules:
- Output generalized literary/thematic concepts (e.g. "grief", "identity", "war", "spirituality", "family", "technology")
- Do not use proper nouns, author names, or titles
- Return [] for any shelf that describes metadata rather than thematic content:
  - Years, numbers, positional names ("2024", "top-10", "book-1")
  - Language-of-reading trackers ("en-francais", "en-espanol", "in-english", "auf-deutsch")
  - Geographic origin or author nationality ("canadian-authors", "books-around-the-world", "african-literature-by-country")
  - Where or how the book was read ("audiobook", "kindle", "library-book", "borrowed")
  - Vague superlatives with no thematic content ("favorites", "best-ever", "love-it")
  - Ownership/status trackers ("owned", "to-buy", "wishlist", "dnf")
- Output valid JSON only — no preamble, no explanation, no code fences
- Format: {"shelf-name": ["tag1", "tag2"], ...}

Examples:
- "tragedy-and-grief" → ["grief", "loss"]
- "faith-and-christian-books" → ["religion", "spirituality"]
- "tech" → ["technology"]
- "heavy-reads" → ["emotional", "literary"]
- "mind-bending" → ["philosophy", "speculative"]
- "queer-lit" → ["lgbtq", "identity"]
- "canadian-authors" → []
- "books-around-the-world" → []
- "en-francais" → []
- "in-english" → []
- "audiobook" → []
- "2024" → []
- "favorites" → []
- "library" → []

Shelves to map: ${JSON.stringify(shelves)}`;

  let delay = 5_000;
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (res.status === 429) {
        if (attempt === 3) {
          console.error("normalize-shelves: exhausted retries on rate limit");
          return NextResponse.json({ mapping: {} });
        }
        console.warn(`normalize-shelves: rate limited — waiting ${delay / 1000}s`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }

      if (!res.ok) {
        console.error("normalize-shelves API error:", res.status, await res.text());
        return NextResponse.json({ mapping: {} });
      }

      const data = await res.json();
      const text: string = data.content?.[0]?.text ?? "";
      const raw = extractJson(text);

      const mapping: Record<string, string[]> = {};
      for (const [shelf, tags] of Object.entries(raw)) {
        if (Array.isArray(tags)) {
          mapping[shelf] = (tags as unknown[])
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.toLowerCase().trim())
            .filter((t) => t.length > 0);
        }
      }

      return NextResponse.json({ mapping });
    } catch (err) {
      if (attempt === 3) {
        console.error("normalize-shelves route error:", err);
        return NextResponse.json({ mapping: {} });
      }
    }
  }

  return NextResponse.json({ mapping: {} });
}
