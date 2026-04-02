import { NextResponse } from "next/server";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Lightweight liveness probe for Docker healthchecks, Traefik, and manual
 * debugging. Returns 200 as long as the Next.js process is running.
 *
 * In development: also reports whether AUTH_SECRET is still the default value
 * so misconfigured deployments are immediately visible.
 *
 * Example response (production):
 *   { "status": "ok", "auth": "configured", "localAuth": false, "time": "..." }
 *
 * Example response (development with default secret):
 *   { "status": "ok", "auth": "warning:default-secret", "localAuth": false, "time": "..." }
 */
export async function GET() {
  const isDev = process.env.NODE_ENV !== "production";
  const usingDefaultSecret = EnvConfig.authSecret === "dev-secret-change-me";

  return NextResponse.json({
    status: "ok",
    auth: isDev && usingDefaultSecret ? "warning:default-secret" : "configured",
    localAuth: EnvConfig.allowLocalAuth,
    time: new Date().toISOString(),
  });
}
