import { NextRequest, NextResponse } from "next/server";
import { extractJson } from "@/lib/extractJson";

interface BookInput {
  title: string;
  author: string;
}

export interface ClaudeEdge {
  a: string;
  b: string;
  themes: string[];
}

async function callClaude(books: BookInput[], apiKey: string, retries = 3): Promise<ClaudeEdge[]> {
  const prompt = `Here is a personal book library. Identify pairs of books that share meaningful thematic connections — similar ideas, emotional territory, moral questions, settings, or character dynamics.

Return ONLY pairs where you are confident the connection is real and specific. Not all books need to connect. Aim for 1–2 connections per book; only go to 3 for books with exceptionally strong thematic ties. Return at most 400 pairs total. Avoid connecting books just because they share a broad genre.

For each pair, include 2–4 short theme labels describing the shared territory (e.g. "grief-and-loss", "colonial-violence", "coming-of-age", "systemic-oppression", "motherhood", "war-trauma", "scientific-ethics", "moral-complicity"). Be specific — not "family" but "estrangement", not "history" but "post-colonial-legacy".

Respond with JSON only — no preamble, no explanation, no markdown fences:
{ "edges": [{ "a": "Title A", "b": "Title B", "themes": ["tag1", "tag2"] }, ...] }

Books:
${books.map((b) => `${b.title} by ${b.author}`).join("\n")}`;

  let delay = 10_000;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 32768,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (res.status === 429) {
      if (attempt === retries) {
        console.error("analyze-library: exhausted retries on rate limit");
        return [];
      }
      console.warn(`analyze-library: rate limited — waiting ${delay / 1000}s`);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
      continue;
    }

    if (!res.ok) {
      console.error("analyze-library API error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    if (data.stop_reason === "max_tokens") {
      console.warn("analyze-library: response truncated at max_tokens — output may be incomplete");
    }
    const text: string = data.content?.[0]?.text ?? "";
    const raw = extractJson(text);

    const edges: ClaudeEdge[] = [];
    const rawEdges = raw["edges"];
    if (Array.isArray(rawEdges)) {
      for (const e of rawEdges) {
        if (typeof e.a === "string" && typeof e.b === "string" && Array.isArray(e.themes)) {
          edges.push({
            a: e.a,
            b: e.b,
            themes: (e.themes as unknown[])
              .filter((t): t is string => typeof t === "string")
              .map((t) => t.toLowerCase().trim().replace(/\s+/g, "-"))
              .filter((t) => t.length > 0 && t.length <= 50),
          });
        }
      }
    }
    return edges;
  }
  return [];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ edges: [] });

  const { books } = (await req.json()) as { books: BookInput[] };
  if (!books?.length) return NextResponse.json({ edges: [] });

  try {
    const edges = await callClaude(books, apiKey);
    return NextResponse.json({ edges });
  } catch (err) {
    console.error("analyze-library error:", err);
    return NextResponse.json({ edges: [] });
  }
}
