import { NextResponse } from "next/server";
import { validateCredentials, verifyUser } from "@/lib/userStore";
import { signSession, ONE_DAY, cookieName } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || "");
    const password = String(body.password || "");

    const validationError = validateCredentials(username, password);
    if (validationError) {
      return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
    }

    const user = await verifyUser(username, password);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const token = signSession(user.id, user.username, ONE_DAY);
    const res = NextResponse.json(
      { ok: true, user: { id: user.id, username: user.username } },
      { status: 200 }
    );
    res.cookies.set({
      name: cookieName(),
      value: token,
      httpOnly: true,
      sameSite: "lax",
      maxAge: ONE_DAY,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
