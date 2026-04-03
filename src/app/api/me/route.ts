import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserById } from "@/lib/userStore";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 200 });

  // Always resolve live data from the store — role/org can change without re-login.
  let role: string = "user";
  let orgGln: string | undefined;
  let orgFhirId: string | undefined;
  let orgName: string | undefined;
  try {
    const user = await getUserById(session.sub);
    if (user?.role) role = user.role;
    orgGln    = user?.profile?.orgGln    ?? undefined;
    orgFhirId = user?.profile?.orgFhirId ?? undefined;
    orgName   = user?.profile?.orgName   ?? undefined;
  } catch {
    // Store unavailable — fall back to safe defaults
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id:       session.sub,
      username: session.username,
      role,
      orgGln,
      orgFhirId,
      orgName,
      hasOrgAccess: !!(orgFhirId || orgGln),
    },
  });
}
