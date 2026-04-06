/**
 * UserJwtService — RFC 7519 JWT (HS256) for API access tokens.
 *
 * Uses the Node.js native crypto module — no external JWT library required.
 * Tokens are signed with AUTH_SECRET (same secret as session cookies).
 *
 * Token structure: base64url(header).base64url(payload).base64url(signature)
 * Algorithm:       HMAC-SHA256 (HS256)
 *
 * Usage:
 *   const jwt = userJwtService.sign({ sub: "u-1", username: "admin", role: "admin" }, 86400);
 *   const payload = userJwtService.verify(jwt); // null if invalid or expired
 */

import crypto from "crypto";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

// ── Types ─────────────────────────────────────────────────────────────────────

export type JwtPayload = {
  sub:      string; // user ID
  username: string;
  role:     string; // "admin" | "user"
  iat:      number; // issued-at (Unix seconds)
  exp:      number; // expires-at (Unix seconds)
};

export type ExpiresIn = "1h" | "24h" | "7d" | "30d" | "90d";

export const EXPIRES_IN_SECONDS: Record<ExpiresIn, number> = {
  "1h":  3_600,
  "24h": 86_400,
  "7d":  604_800,
  "30d": 2_592_000,
  "90d": 7_776_000,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Pre-encoded fixed JWT header: { "alg": "HS256", "typ": "JWT" }
const FIXED_HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  .toString("base64")
  .replace(/=/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_");

function b64url(data: Buffer | string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(b64: string): string {
  return Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function getSecret(): string {
  return EnvConfig.authSecret;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class UserJwtService {
  /**
   * Sign a JWT for the given user.
   * @param payload  User identity fields (iat/exp added automatically)
   * @param expiresInSeconds  Token lifetime in seconds
   */
  sign(
    payload: Omit<JwtPayload, "iat" | "exp">,
    expiresInSeconds: number,
  ): string {
    const now         = Math.floor(Date.now() / 1000);
    const fullPayload: JwtPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
    const payloadB64  = b64url(JSON.stringify(fullPayload));
    const signingInput = `${FIXED_HEADER}.${payloadB64}`;
    const sig = b64url(
      crypto.createHmac("sha256", getSecret()).update(signingInput).digest(),
    );
    return `${signingInput}.${sig}`;
  }

  /**
   * Verify a JWT and return its payload.
   * Returns null when the token is malformed, has an invalid signature, or is expired.
   */
  verify(token: string): JwtPayload | null {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts as [string, string, string];

    if (header !== FIXED_HEADER) return null;

    const expectedSig = b64url(
      crypto.createHmac("sha256", getSecret()).update(`${header}.${payload}`).digest(),
    );
    if (expectedSig !== sig) return null;

    try {
      const p = JSON.parse(b64urlDecode(payload)) as JwtPayload;
      if (typeof p.exp !== "number" || p.exp < Math.floor(Date.now() / 1000)) return null;
      if (!p.sub || !p.role) return null;
      return p;
    } catch {
      return null;
    }
  }
}

export const userJwtService = new UserJwtService();
