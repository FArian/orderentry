import { createHash } from "crypto";
import type { IAuthStrategy, AuthResult } from "./IAuthStrategy";
import type { DigestAuthConfig } from "../types/AuthConfig";

/**
 * HTTP Digest Authentication (RFC 7616) with MD5 and qop=auth.
 *
 * Use for:
 *   - Legacy FHIR/HL7 servers that mandate Digest over Basic
 *   - Labsoft or LIS gateways using digest-protected REST APIs
 *
 * ENV vars (FHIR):
 *   FHIR_AUTH_TYPE=digest
 *   FHIR_AUTH_USER=<username>
 *   FHIR_AUTH_PASSWORD=<password>
 *
 * ⚠️  CHALLENGE-RESPONSE FLOW — the caller must handle the 2-step handshake:
 *   1. Initial apply() returns empty headers (no challenge known yet).
 *   2. Server responds with 401 + WWW-Authenticate: Digest realm=...
 *   3. Caller invokes authService.updateDigestChallenge(wwwAuthenticateHeader).
 *   4. Retry: apply() now returns the full Authorization: Digest ... header.
 *   FhirClient handles this automatically when FHIR_AUTH_TYPE=digest.
 */

// ── Challenge parsing ─────────────────────────────────────────────────────────

interface DigestChallenge {
  realm:      string;
  nonce:      string;
  qop?:       string;
  opaque?:    string;
  algorithm?: string;
}

function parseChallenge(wwwAuthenticate: string): DigestChallenge {
  const params: Record<string, string> = {};
  for (const [, key, value] of wwwAuthenticate.matchAll(/(\w+)="([^"]+)"/g)) {
    if (key) params[key] = value ?? "";
  }
  return {
    realm: params["realm"] ?? "",
    nonce: params["nonce"] ?? "",
    ...(params["qop"]       ? { qop:       params["qop"] }       : {}),
    ...(params["opaque"]    ? { opaque:    params["opaque"] }     : {}),
    ...(params["algorithm"] ? { algorithm: params["algorithm"] }  : {}),
  };
}

// ── Digest computation ────────────────────────────────────────────────────────

function md5(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}

function computeHA1(username: string, realm: string, password: string): string {
  return md5(`${username}:${realm}:${password}`);
}

function computeHA2(method: string, uri: string): string {
  return md5(`${method.toUpperCase()}:${uri}`);
}

function computeResponse(
  ha1: string, ha2: string, nonce: string, nc: string, cnonce: string, qop?: string,
): string {
  if (qop === "auth") return md5(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`);
  return md5(`${ha1}:${nonce}:${ha2}`);
}

function buildAuthHeader(
  username: string, challenge: DigestChallenge, uri: string,
  nc: string, cnonce: string, response: string,
): string {
  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `nc=${nc}`,
    `cnonce="${cnonce}"`,
    `response="${response}"`,
    ...(challenge.qop    ? [`qop=${challenge.qop}`]        : []),
    ...(challenge.opaque ? [`opaque="${challenge.opaque}"`] : []),
  ];
  return `Digest ${parts.join(", ")}`;
}

// ── Strategy ──────────────────────────────────────────────────────────────────

export class DigestStrategy implements IAuthStrategy {
  private readonly config: DigestAuthConfig;
  private challenge: DigestChallenge | null = null;
  private nonceCount = 0;

  constructor(config: DigestAuthConfig) {
    if (!config.username) throw new Error("DigestStrategy: username must not be empty");
    this.config = config;
  }

  /** Call this with the WWW-Authenticate header value from a 401 response. */
  updateChallenge(wwwAuthenticate: string): void {
    this.challenge = parseChallenge(wwwAuthenticate);
    this.nonceCount = 0;
  }

  async apply(url: string, method: string): Promise<AuthResult> {
    if (!this.challenge) return { headers: {}, searchParams: {} };

    this.nonceCount += 1;
    const nc     = this.nonceCount.toString(16).padStart(8, "0");
    const cnonce = Math.random().toString(36).slice(2, 10);
    const parsed = new URL(url);
    const uri    = parsed.pathname + parsed.search;

    const ha1      = computeHA1(this.config.username, this.challenge.realm, this.config.password);
    const ha2      = computeHA2(method, uri);
    const response = computeResponse(ha1, ha2, this.challenge.nonce, nc, cnonce, this.challenge.qop);
    const header   = buildAuthHeader(this.config.username, this.challenge, uri, nc, cnonce, response);

    return { headers: { Authorization: header }, searchParams: {} };
  }
}
