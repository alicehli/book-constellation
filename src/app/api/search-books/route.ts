import { NextRequest, NextResponse } from "next/server";

// Upstream failures return 502 (not an empty result) so the client can tell
// "no match" apart from "lookup failed" and retry the latter later.
export async function GET(req: NextRequest) {
  // The read-only deployment never searches; don't spend the Books API quota on it
  if (process.env.NEXT_PUBLIC_READ_ONLY === "true") return new NextResponse(null, { status: 404 });

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;

  // Single-volume fetch (returns richer category data than search results)
  const volumeId = req.nextUrl.searchParams.get("volumeId");
  if (volumeId) {
    // Google Books IDs are short URL-safe tokens; reject anything else so it can't alter the path
    if (!/^[\w-]{1,64}$/.test(volumeId)) return NextResponse.json({}, { status: 400 });
    const keyParam = apiKey ? `?key=${encodeURIComponent(apiKey)}` : "";
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${volumeId}${keyParam}`);
      if (!res.ok) return NextResponse.json({}, { status: res.status === 404 ? 404 : 502 });
      return NextResponse.json(await res.json());
    } catch {
      return NextResponse.json({}, { status: 502 });
    }
  }

  const q = req.nextUrl.searchParams.get("q");
  const requested = parseInt(req.nextUrl.searchParams.get("maxResults") ?? "5", 10);
  const maxResults = String(Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 40) : 5);
  if (!q) return NextResponse.json({ items: [] });

  const params = new URLSearchParams({ q, maxResults });
  if (apiKey) params.set("key", apiKey);

  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
    if (!res.ok) return NextResponse.json({ items: [] }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 });
  }
}
