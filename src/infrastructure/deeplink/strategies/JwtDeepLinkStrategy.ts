/**
 * JwtDeepLinkStrategy — validates HS256 JWTs issued by external KIS/PIS systems.
 *
 * Token contract:
 *   alg: HS256
 *   iss: <sourceSystem>  — must be in DEEPLINK_ALLOWED_SYSTEMS (comma-separated)
 *   sub: <patientId>     — FHIR Patient ID
 *   jti: <uuid>          — unique nonce; rejected on replay
 *   exp: <unix>          — max DEEPLINK_TOKEN_MAX_AGE_SECONDS from iat
 *   iat: <unix>
 *   context (optional):  "order-entry" | "patient" | "results"
 *   encounterId (opt):   FHIR Encounter ID
 *   coverageId  (opt):   FHIR Coverage ID
 *
 * Secret: DEEPLINK_JWT_SECRET (separate from AUTH_SECRET)
 */

import crypto from "crypto";
import type { IDeepLinkAuthStrategy, DeepLinkAuthResult } from "@/application/interfaces/IDeepLinkAuthStrategy";
import type { DeepLinkContext, DeepLinkContextType } from "@/domain/entities/DeepLinkContext";
import { nonceCache } from "../NonceCache";

const VALID_CONTEXT_TYPES: readonly DeepLinkContextType[] = ["order-entry", "patient", "results"];
const FIXED_HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  .toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

function b64url(data: Buffer): string {
  return data.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

type RawPayload = {
  iss?: unknown; sub?: unknown; jti?: unknown;
  exp?: unknown; iat?: unknown;
  context?: unknown; encounterId?: unknown; coverageId?: unknown;
};

export class JwtDeepLinkStrategy implements IDeepLinkAuthStrategy {
  private readonly secret: string;
  private readonly maxAgeSec: number;
  private readonly allowedSystems: readonly string[];

  constructor(secret: string, maxAgeSec: number, allowedSystems: readonly string[]) {
    this.secret         = secret;
    this.maxAgeSec      = maxAgeSec;
    this.allowedSystems = allowedSystems;
  }

  async validate(token: string): Promise<DeepLinkAuthResult> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { ok: false, error: { code: "INVALID_TOKEN", message: "Malformed JWT" } };
    }
    const [header, payload, sig] = parts as [string, string, string];

    if (header !== FIXED_HEADER) {
      return { ok: false, error: { code: "INVALID_TOKEN", message: "Invalid JWT header" } };
    }

    const expectedSig = b64url(
      crypto.createHmac("sha256", this.secret).update(`${header}.${payload}`).digest(),
    );
    if (expectedSig !== sig) {
      return { ok: false, error: { code: "INVALID_TOKEN", message: "JWT signature invalid" } };
    }

    let raw: RawPayload;
    try {
      raw = JSON.parse(b64urlDecode(payload)) as RawPayload;
    } catch {
      return { ok: false, error: { code: "INVALID_TOKEN", message: "JWT payload not valid JSON" } };
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof raw.exp !== "number" || raw.exp < now) {
      return { ok: false, error: { code: "EXPIRED_TOKEN", message: "JWT has expired" } };
    }
    if (typeof raw.iat === "number" && raw.iat > now + 60) {
      return { ok: false, error: { code: "INVALID_TOKEN", message: "JWT issued in the future" } };
    }
    if (typeof raw.iat === "number" && now - raw.iat > this.maxAgeSec) {
      return { ok: false, error: { code: "EXPIRED_TOKEN", message: "JWT exceeds maximum age" } };
    }

    if (typeof raw.sub !== "string" || !raw.sub) {
      return { ok: false, error: { code: "INVALID_TOKEN", message: "Missing sub claim (patientId)" } };
    }
    if (typeof raw.jti !== "string" || !raw.jti) {
      return { ok: false, error: { code: "INVALID_TOKEN", message: "Missing jti claim (nonce)" } };
    }
    if (typeof raw.iss !== "string" || !raw.iss) {
      return { ok: false, error: { code: "INVALID_TOKEN", message: "Missing iss claim (source system)" } };
    }

    if (this.allowedSystems.length > 0 && !this.allowedSystems.includes(raw.iss)) {
      return { ok: false, error: { code: "UNKNOWN_SYSTEM", message: `Source system not allowed: ${raw.iss}` } };
    }

    if (!nonceCache.consume(raw.jti, raw.exp - now + 60)) {
      return { ok: false, error: { code: "REPLAY_ATTACK", message: "Token already used (replay detected)" } };
    }

    const contextType: DeepLinkContextType =
      VALID_CONTEXT_TYPES.includes(raw.context as DeepLinkContextType)
        ? (raw.context as DeepLinkContextType)
        : "order-entry";

    const context: DeepLinkContext = {
      patientId:    raw.sub,
      sourceSystem: raw.iss,
      nonce:        raw.jti,
      contextType,
      requestedAt:  typeof raw.iat === "number" ? raw.iat : now,
      ...(typeof raw.encounterId === "string" && raw.encounterId ? { encounterId: raw.encounterId } : {}),
      ...(typeof raw.coverageId  === "string" && raw.coverageId  ? { coverageId:  raw.coverageId  } : {}),
    };

    return { ok: true, context };
  }
}
