/**
 * Next.js Edge Middleware — logs all /api/* requests.
 *
 * Runs on the Edge runtime before the request reaches the route handler.
 * The route controllers log the response (status, count, errors), so together
 * they cover the full request/response cycle in the server terminal.
 *
 * Edge runtime constraints: no Node.js APIs (no fs, no path).
 * We write directly to console.log in the same JSON format as Logger.ts.
 *
 * Output example:
 *   {"time":"…","level":"info","ctx":"Middleware","msg":"GET /api/patients","search":"?q=Muster"}
 */

import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest): NextResponse {
  const { method, nextUrl } = request;

  const entry = JSON.stringify({
    time: new Date().toISOString(),
    level: "info",
    ctx: "Middleware",
    msg: `${method} ${nextUrl.pathname}`,
    ...(nextUrl.search ? { search: nextUrl.search } : {}),
  });

  console.log(entry);

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
