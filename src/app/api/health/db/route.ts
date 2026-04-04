/**
 * GET /api/health/db
 *
 * Returns the DB connection status and provider info.
 * Used by the admin UI status indicator and external health checks.
 *
 * Response 200: { ok: true, provider, latencyMs }
 * Response 503: { ok: false, provider, error }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prismaClient";
import { resolveDbConfig, maskDbUrl } from "@/infrastructure/db/DatabaseConfig";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const config = resolveDbConfig();
  const start  = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok:        true,
      provider:  config.provider,
      url:       maskDbUrl(config.url),
      latencyMs: Date.now() - start,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, provider: config.provider, error: message },
      { status: 503 },
    );
  }
}
