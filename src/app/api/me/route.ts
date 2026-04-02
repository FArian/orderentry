import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserById } from "@/lib/userStore";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 200 });

  // Always resolve the live role from the store — roles can be changed by an
  // admin without requiring the user to re-login.
  let role: string = "user";
  try {
    const user = await getUserById(session.sub);
    if (user?.role) role = user.role;
  } catch {
    // Store unavailable — fall back to "user" (safe default)
  }

  return NextResponse.json({
    authenticated: true,
    user: { id: session.sub, username: session.username, role },
  });
}
