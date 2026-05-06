import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_READ_ONLY === "true") {
    return NextResponse.rewrite(new URL("/graph", request.url));
  }
}

export const config = { matcher: "/" };
