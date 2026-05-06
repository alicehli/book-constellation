import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const maxResults = req.nextUrl.searchParams.get("maxResults") ?? "5";
  if (!q) return NextResponse.json({ items: [] });

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({ q, maxResults });
  if (apiKey) params.set("key", apiKey);

  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
    if (!res.ok) return NextResponse.json({ items: [] });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ items: [] });
  }
}
