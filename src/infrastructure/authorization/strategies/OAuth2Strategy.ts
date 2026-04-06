import type { IAuthStrategy, AuthResult } from "./IAuthStrategy";
import type { OAuth2AuthConfig } from "../types/AuthConfig";
import { createLogger } from "../../logging/Logger";

const logger = createLogger("OAuth2Strategy");

// ── Token cache ───────────────────────────────────────────────────────────────

interface CachedToken {
  readonly accessToken: string;
  readonly expiresAt: number; // epoch ms
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

/** Module-level cache — one entry per unique (clientId + tokenUrl + scopes). */
const tokenCache = new Map<string, CachedToken>();

function buildCacheKey(config: OAuth2AuthConfig): string {
  const scopes = [...(config.scopes ?? [])].sort().join(",");
  return `${config.clientId}::${config.tokenUrl}::${scopes}`;
}

function isFresh(entry: CachedToken): boolean {
  // Refresh 30 s before actual expiry to avoid race conditions
  return Date.now() < entry.expiresAt - 30_000;
}

// ── Token fetching ────────────────────────────────────────────────────────────

async function fetchAccessToken(
  config: OAuth2AuthConfig,
  fetchFn: typeof fetch,
): Promise<CachedToken> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    ...(config.scopes?.length ? { scope: config.scopes.join(" ") } : {}),
  });

  const res = await fetchFn(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`OAuth2 token fetch failed: HTTP ${res.status} from ${config.tokenUrl}`);

  const data = (await res.json()) as TokenResponse;
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

// ── Strategy ──────────────────────────────────────────────────────────────────

/**
 * OAuth 2.0 Client Credentials flow with in-memory token caching + auto-refresh.
 *
 * Use for:
 *   - Keycloak-protected FHIR servers (SMART on FHIR backend services)
 *   - Enterprise APIs that issue short-lived JWTs via a token endpoint
 *
 * ENV vars (FHIR):
 *   FHIR_AUTH_TYPE=oauth2
 *   FHIR_AUTH_CLIENT_ID=<id>
 *   FHIR_AUTH_CLIENT_SECRET=<secret>
 *   FHIR_AUTH_TOKEN_URL=https://keycloak/realms/z2lab/protocol/openid-connect/token
 *   FHIR_AUTH_SCOPES=fhir/read fhir/write   (space-separated, optional)
 *
 * ⚠️  authorization_code is NOT supported here — that flow requires a browser
 *    redirect. Use the session-based HMAC auth system for human users.
 */
export class OAuth2Strategy implements IAuthStrategy {
  private readonly config: OAuth2AuthConfig;
  private readonly fetchFn: typeof fetch;

  constructor(config: OAuth2AuthConfig, fetchFn: typeof fetch = fetch) {
    if (config.grantType !== "client_credentials") {
      throw new Error(
        "OAuth2Strategy only supports client_credentials. " +
        "Use the session auth flow (lib/auth.ts) for authorization_code.",
      );
    }
    this.config = config;
    this.fetchFn = fetchFn;
  }

  async apply(_url: string, _method: string): Promise<AuthResult> {
    const key   = buildCacheKey(this.config);
    let   entry = tokenCache.get(key);

    if (!entry || !isFresh(entry)) {
      logger.info("Fetching OAuth2 access token", { clientId: this.config.clientId });
      entry = await fetchAccessToken(this.config, this.fetchFn);
      tokenCache.set(key, entry);
    }

    return { headers: { Authorization: `Bearer ${entry.accessToken}` }, searchParams: {} };
  }

  /**
   * Force-invalidate the cached token (e.g. after a 401 response from the
   * resource server indicating the token was revoked).
   */
  invalidateToken(): void {
    tokenCache.delete(buildCacheKey(this.config));
    logger.info("OAuth2 token cache invalidated", { clientId: this.config.clientId });
  }
}
