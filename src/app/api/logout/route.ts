import { NextResponse } from "next/server";
import { cookieName } from "@/lib/auth";

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
  return res;
}

export async function POST(req: Request) {
  // Also support POST for programmatic logout
  return GET(req);
}
