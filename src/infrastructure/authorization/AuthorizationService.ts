/**
 * Centralized outbound Authorization Service.
 *
 * Selects and delegates to the correct authentication strategy based on an
 * AuthConfig. Strategies are constructed once and reused — they are stateful
 * only for OAuth2 (token cache) and Digest (challenge cache).
 *
 * Usage — basic:
 *   const svc = new AuthorizationService({ type: "bearer", token: "abc" });
 *   const { headers } = await svc.applyToRequest("https://fhir/Patient", "GET");
 *   fetch(url, { headers: { ...existingHeaders, ...headers } });
 *
 * Usage — with URL search params (API key in query):
 *   const { headers, searchParams } = await svc.applyToRequest(url, "GET");
 *   const finalUrl = applySearchParams(url, searchParams);
 *   fetch(finalUrl, { headers: { ...existingHeaders, ...headers } });
 *
 * Usage — Digest (automatic 2-step flow in FhirClient):
 *   // Step 1: initial request → 401 → parse WWW-Authenticate
 *   svc.updateDigestChallenge(res.headers.get("www-authenticate") ?? "");
 *   // Step 2: retry — apply() now returns full Authorization header
 *   const { headers } = await svc.applyToRequest(url, method);
 */

import type { AuthConfig } from "./types/AuthConfig";
import type { IAuthStrategy, AuthResult } from "./strategies/IAuthStrategy";
import { NoAuthStrategy }    from "./strategies/NoAuthStrategy";
import { BearerStrategy }    from "./strategies/BearerStrategy";
import { BasicStrategy }     from "./strategies/BasicStrategy";
import { ApiKeyStrategy }    from "./strategies/ApiKeyStrategy";
import { OAuth2Strategy }    from "./strategies/OAuth2Strategy";
import { DigestStrategy }    from "./strategies/DigestStrategy";

export class AuthorizationService {
  private readonly strategy: IAuthStrategy;

  constructor(config: AuthConfig) {
    this.strategy = AuthorizationService.createStrategy(config);
  }

  private static createStrategy(config: AuthConfig): IAuthStrategy {
    switch (config.type) {
      case "bearer":  return new BearerStrategy(config);
      case "basic":   return new BasicStrategy(config);
      case "apiKey":  return new ApiKeyStrategy(config);
      case "oauth2":  return new OAuth2Strategy(config);
      case "digest":  return new DigestStrategy(config);
      case "none":    return new NoAuthStrategy();
    }
  }

  /** Returns headers + searchParams to attach to the outgoing request. */
  async applyToRequest(url: string, method: string): Promise<AuthResult> {
    return this.strategy.apply(url, method);
  }

  /**
   * Convenience: merge auth headers into an existing headers object.
   * Returns a new object; does NOT mutate the input.
   */
  async mergeHeaders(
    url: string,
    method: string,
    existing: Record<string, string> = {},
  ): Promise<Record<string, string>> {
    const { headers } = await this.strategy.apply(url, method);
    return { ...existing, ...headers };
  }

  /**
   * Append auth query params to a URL string.
   * Returns the original URL unchanged if the strategy produces no search params.
   */
  async applySearchParams(url: string, method: string): Promise<string> {
    const { searchParams } = await this.strategy.apply(url, method);
    if (Object.keys(searchParams).length === 0) return url;
    const parsed = new URL(url);
    for (const [k, v] of Object.entries(searchParams)) parsed.searchParams.set(k, v);
    return parsed.toString();
  }

  /**
   * Digest only: supply the WWW-Authenticate challenge from a 401 response
   * so the next apply() call produces the correct Authorization header.
   * No-op for all other strategy types.
   */
  updateDigestChallenge(wwwAuthenticate: string): void {
    if (this.strategy instanceof DigestStrategy) {
      this.strategy.updateChallenge(wwwAuthenticate);
    }
  }

  /**
   * OAuth2 only: invalidate the cached access token (e.g. after a 401 from
   * the resource server indicating the token was revoked).
   * No-op for all other strategy types.
   */
  invalidateOAuth2Token(): void {
    if (this.strategy instanceof OAuth2Strategy) {
      this.strategy.invalidateToken();
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Merge auth search params AND headers into a fetch-ready options object.
 * Returns { url: string, headers: Record<string, string> }.
 */
export async function applyAuth(
  service: AuthorizationService,
  url: string,
  method: string,
  existingHeaders: Record<string, string> = {},
): Promise<{ url: string; headers: Record<string, string> }> {
  const result = await service.applyToRequest(url, method);
  const headers = { ...existingHeaders, ...result.headers };

  if (Object.keys(result.searchParams).length === 0) return { url, headers };
  const parsed = new URL(url);
  for (const [k, v] of Object.entries(result.searchParams)) parsed.searchParams.set(k, v);
  return { url: parsed.toString(), headers };
}
