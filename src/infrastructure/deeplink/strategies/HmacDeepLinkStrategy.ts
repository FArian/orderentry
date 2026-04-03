/**
 * HmacDeepLinkStrategy — validates HMAC-SHA256-signed deep-link URLs.
 *
 * Signing convention (sender side):
 *   1. Build the canonical URL without the &sig= parameter.
 *   2. Compute HMAC-SHA256(DEEPLINK_HMAC_SECRET, canonicalUrl).
 *   3. Append &sig=<hex digest>.
 *
 * Required query parameters:
 *   patientId   — FHIR Patient ID
 *   ts          — Unix timestamp (seconds) of signature creation
 *   nonce       — random UUID or hex string (replay protection)
 *   source      — source system identifier
 *   sig         — HMAC-SHA256 hex digest of canonical URL
 *
 * Optional query parameters:
 *   context     — "order-entry" | "patient" | "results" (default: order-entry)
 *   encounterId — FHIR Encounter ID
 *   coverageId  — FHIR Coverage ID
 */

import crypto from "crypto";
import type { IDeepLinkAuthStrategy, DeepLinkAuthResult } from "@/application/interfaces/IDeepLinkAuthStrategy";
import type { DeepLinkContext, DeepLinkContextType } from "@/domain/entities/DeepLinkContext";
import { nonceCache } from "../NonceCache";

const VALID_CONTEXT_TYPES: readonly DeepLinkContextType[] = ["order-entry", "patient", "results"];

export class HmacDeepLinkStrategy implements IDeepLinkAuthStrategy {
  private readonly secret: string;
  private readonly maxAgeSec: number;
  private readonly allowedSystems: readonly string[];

  constructor(secret: string, maxAgeSec: number, allowedSystems: readonly string[]) {
    this.secret         = secret;
    this.maxAgeSec      = maxAgeSec;
    this.allowedSystems = allowedSystems;
  }

  async validate(_token: string, rawUrl: string): Promise<DeepLinkAuthResult> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { ok: false, error: { code: "INVALID_TOKEN", message: "Cannot parse request URL" } };
    }

    const patientId = parsed.searchParams.get("patientId") ?? "";
    const tsStr     = parsed.searchParams.get("ts")        ?? "";
    const nonce     = parsed.searchParams.get("nonce")     ?? "";
    const source    = parsed.searchParams.get("source")    ?? "";
    const sig       = parsed.searchParams.get("sig")       ?? "";

    if (!patientId || !tsStr || !nonce || !source || !sig) {
      return { ok: false, error: { code: "MISSING_TOKEN", message: "Missing required HMAC parameters (patientId, ts, nonce, source, sig)" } };
    }

    const ts = parseInt(tsStr, 10);
    if (isNaN(ts)) {
      return { ok: false, error: { code: "INVALID_TOKEN", message: "Invalid ts parameter" } };
    }

    const now = Math.floor(Date.now() / 1000);
    const age = now - ts;
    if (age < -60) {
      return { ok: false, error: { code: "INVALID_TOKEN", message: "Request timestamp is in the future" } };
    }
    if (age > this.maxAgeSec) {
      return { ok: false, error: { code: "EXPIRED_TOKEN", message: "HMAC signature has expired" } };
    }

    if (this.allowedSystems.length > 0 && !this.allowedSystems.includes(source)) {
      return { ok: false, error: { code: "UNKNOWN_SYSTEM", message: `Source system not allowed: ${source}` } };
    }

    // Canonical URL = full URL without the sig parameter, sorted params
    const canonical = this.buildCanonicalUrl(parsed);
    const expected  = crypto.createHmac("sha256", this.secret).update(canonical).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig.padEnd(expected.length, "0").slice(0, expected.length), "hex"))) {
      // Length-safe comparison
      if (expected !== sig) {
        return { ok: false, error: { code: "INVALID_TOKEN", message: "HMAC signature mismatch" } };
      }
    }

    if (!nonceCache.consume(nonce, this.maxAgeSec + 120)) {
      return { ok: false, error: { code: "REPLAY_ATTACK", message: "Nonce already used (replay detected)" } };
    }

    const rawContext    = parsed.searchParams.get("context") ?? "";
    const encounterId   = parsed.searchParams.get("encounterId") ?? "";
    const coverageId    = parsed.searchParams.get("coverageId")  ?? "";
    const contextType: DeepLinkContextType =
      VALID_CONTEXT_TYPES.includes(rawContext as DeepLinkContextType)
        ? (rawContext as DeepLinkContextType)
        : "order-entry";

    const context: DeepLinkContext = {
      patientId,
      sourceSystem: source,
      nonce,
      contextType,
      requestedAt: ts,
      ...(encounterId ? { encounterId } : {}),
      ...(coverageId  ? { coverageId  } : {}),
    };

    return { ok: true, context };
  }

  /** Canonical URL: strip sig, sort remaining params alphabetically. */
  private buildCanonicalUrl(url: URL): string {
    const copy = new URL(url.toString());
    copy.searchParams.delete("sig");
    copy.searchParams.sort();
    return copy.toString();
  }
}
