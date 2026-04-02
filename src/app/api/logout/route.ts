import { NextResponse } from "next/server";
import { cookieName } from "@/lib/auth";
import { LOCAL_SESSION_COOKIE } from "@/lib/localAuthShared";
import { logAuth } from "@/lib/logAuth";

export async function GET(req: Request) {
  logAuth("LOGOUT", { method: "GET" });

  // 302 (not the default 307) causes browsers to convert a POST redirect to GET,
  // so form-based logout lands on GET /login instead of re-POSTing to it.
  const res = NextResponse.redirect(new URL("/login", new URL(req.url).origin), 302);

  const cookieBase = {
    value: "",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
    secure: process.env.NODE_ENV === "production",
  } as const;

  // Clear the server-signed session cookie.
  res.cookies.set({
    ...cookieBase,
    name: cookieName(),
    httpOnly: true,
    sameSite: "lax",
  });

  // Clear the client-set local fallback cookie.
  // httpOnly must be false — this cookie was written by document.cookie.
  res.cookies.set({
    ...cookieBase,
    name: LOCAL_SESSION_COOKIE,
    httpOnly: false,
    sameSite: "lax",
  });

  return res;
}

export async function POST(req: Request) {
  // Support POST for programmatic logout (fetch("/api/logout", { method: "POST" }))
  return GET(req);
}
