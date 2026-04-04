/**
 * GET /api/v1/agent/status
 *
 * Lightweight connectivity check for Edge Lite / Edge Full agents.
 * The agent calls this on startup and periodically to verify:
 *   - Network connectivity to OrderEntry
 *   - Token validity
 *   - Whether HL7 proxy is configured
 *
 * Auth: Bearer JWT or PAT, or session cookie
 *
 * Response 200:
 *   {
 *     ok: true,
 *     version: string,           // NEXT_PUBLIC_APP_VERSION
 *     hl7ProxyEnabled: boolean,  // true if ORCHESTRA_HL7_BASE is set
 *     time: string               // ISO 8601 server time
 *   }
 */

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { bearerAuthGuard } from "@/infrastructure/auth/BearerAuthGuard";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const session = await getSessionFromCookies();
  const bearer  = await bearerAuthGuard.resolve(req.headers.get("authorization"));

  if (!session && !bearer) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok:              true,
    version:         process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
    hl7ProxyEnabled: !!EnvConfig.orchestraHl7Base,
    time:            new Date().toISOString(),
  });
}
