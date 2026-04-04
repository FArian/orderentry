/**
 * GET /api/idle-timeout
 *
 * Returns the configured idle session timeout for the client-side
 * inactivity guard. Only callable by authenticated users.
 *
 * Response 200: { minutes: number }   — 0 means disabled
 * Response 401: Unauthorized
 */

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ minutes: EnvConfig.sessionIdleTimeoutMinutes });
}
