/**
 * GET /api/deeplink/order-entry
 *
 * Deep-link entry point for external KIS/PIS systems.
 * Validates the token, verifies the FHIR Patient, and issues a 302 redirect
 * to the order-entry workflow with the patient pre-loaded.
 *
 * Auth strategies (DEEPLINK_AUTH_TYPE):
 *   jwt  — HS256 JWT in ?token= parameter (default)
 *   hmac — HMAC-SHA256 URL signature via ?sig=, ?ts=, ?nonce=, ?source=
 *
 * Security:
 *   - Nonce/JTI replay protection (in-memory NonceCache)
 *   - Source-system allowlist (DEEPLINK_ALLOWED_SYSTEMS)
 *   - Token max-age enforcement (DEEPLINK_TOKEN_MAX_AGE_SECONDS, default 300s)
 *   - FHIR Patient existence verification before redirect
 *   - Full audit log on every request (success + failure)
 *
 * On error: redirect to /deeplink/error?code=<CODE>&reason=<msg> (302)
 *           so the browser lands on a user-friendly error page.
 */

import { NextResponse } from "next/server";
import { processDeepLink } from "@/infrastructure/deeplink/DeepLinkService";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url     = new URL(req.url);
  const token   = url.searchParams.get("token") ?? "";
  const sourceIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                ?? req.headers.get("x-real-ip")
                ?? undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  const result = await processDeepLink({ token, url: req.url, sourceIp, userAgent });

  if (result.ok) {
    return NextResponse.redirect(new URL(result.redirectUrl, url.origin), 302);
  }

  // On error redirect to the frontend error page (never expose raw errors to browser)
  const errorUrl = new URL("/deeplink/error", url.origin);
  errorUrl.searchParams.set("code",   result.code);
  errorUrl.searchParams.set("status", String(result.httpStatus));
  return NextResponse.redirect(errorUrl, 302);
}
