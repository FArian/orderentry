/**
 * DeepLinkAuthStrategyFactory — selects the correct auth strategy based on ENV.
 *
 * DEEPLINK_AUTH_TYPE: "jwt" (default) | "hmac"
 *
 * ENV vars consumed:
 *   DEEPLINK_AUTH_TYPE          — "jwt" or "hmac"
 *   DEEPLINK_JWT_SECRET         — secret for JWT strategy
 *   DEEPLINK_HMAC_SECRET        — secret for HMAC strategy
 *   DEEPLINK_TOKEN_MAX_AGE_SECONDS — max token/signature age (default 300)
 *   DEEPLINK_ALLOWED_SYSTEMS    — comma-separated allowlist (empty = accept all)
 */

import type { IDeepLinkAuthStrategy } from "@/application/interfaces/IDeepLinkAuthStrategy";
import { JwtDeepLinkStrategy }  from "./strategies/JwtDeepLinkStrategy";
import { HmacDeepLinkStrategy } from "./strategies/HmacDeepLinkStrategy";

function getAllowedSystems(): readonly string[] {
  const raw = process.env.DEEPLINK_ALLOWED_SYSTEMS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getMaxAgeSec(): number {
  const raw = parseInt(process.env.DEEPLINK_TOKEN_MAX_AGE_SECONDS ?? "300", 10);
  return isNaN(raw) || raw <= 0 ? 300 : raw;
}

export function createDeepLinkAuthStrategy(): IDeepLinkAuthStrategy {
  const authType      = (process.env.DEEPLINK_AUTH_TYPE ?? "jwt").toLowerCase();
  const allowedSystems = getAllowedSystems();
  const maxAgeSec      = getMaxAgeSec();

  if (authType === "hmac") {
    const secret = process.env.DEEPLINK_HMAC_SECRET ?? "";
    return new HmacDeepLinkStrategy(secret, maxAgeSec, allowedSystems);
  }

  // Default: JWT
  const secret = process.env.DEEPLINK_JWT_SECRET ?? "";
  return new JwtDeepLinkStrategy(secret, maxAgeSec, allowedSystems);
}

/** Module-level singleton — created once at process startup. */
export const deepLinkAuthStrategy: IDeepLinkAuthStrategy = createDeepLinkAuthStrategy();
