import { NextResponse } from "next/server";
import { cookieName } from "@/lib/auth";
import { LOCAL_SESSION_COOKIE } from "@/lib/localAuthShared";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", new URL(req.url).origin));
  res.cookies.set({
    name: cookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  // Also clear local fallback session cookie (client-set)
  res.cookies.set({
    name: LOCAL_SESSION_COOKIE,
    value: "",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function POST(req: Request) {
  // Also support POST for programmatic logout
  return GET(req);
}
