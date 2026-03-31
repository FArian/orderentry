import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserById, updateUserProfile } from "@/lib/userStore";
import type { UserProfile } from "@/lib/userStore";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserById(session.sub);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    profile: user.profile ?? {},
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: UserProfile;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only allow known profile fields
  const allowed: (keyof UserProfile)[] = [
    "gln", "firstName", "lastName", "organization",
    "street", "streetNo", "zip", "city", "canton", "country",
    "email", "phone",
  ];
  const clean: UserProfile = {};
  for (const key of allowed) {
    if (key in body && typeof body[key] === "string") {
      (clean as Record<string, string>)[key] = (body[key] as string).trim();
    }
  }

  try {
    const updated = await updateUserProfile(session.sub, clean);
    return NextResponse.json({ profile: updated.profile ?? {} });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }
}
