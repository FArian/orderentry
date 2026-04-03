/**
 * Discriminated union of all supported outbound authentication configurations.
 *
 * Each variant maps 1:1 to a strategy class in ../strategies/.
 * The `type` field is the discriminant used by AuthorizationService to
 * select the correct strategy at runtime.
 *
 * CREDENTIAL STORAGE RULES:
 *   - Secrets (tokens, passwords, client secrets) → ENV vars only. Never hardcode.
 *   - Non-secret fields (URLs, key names, auth type) → also ENV, editable via admin UI.
 *   - Never store credentials in localStorage, cookies, or client-side state.
 */

/** RFC 6750 Bearer token — JWT or opaque PAT. */
export interface BearerAuthConfig {
  readonly type: "bearer";
  /** Raw token value — set via ENV, never from user input. */
  readonly token: string;
}

/** RFC 7617 HTTP Basic Authentication. */
export interface BasicAuthConfig {
  readonly type: "basic";
  readonly username: string;
  readonly password: string;
}

/**
 * API Key — arbitrary key-value injected as a header or query parameter.
 * Common for: Prometheus, Grafana APIs, legacy REST services.
 */
export interface ApiKeyAuthConfig {
  readonly type: "apiKey";
  /** Header name or query param name (e.g. "X-Api-Key", "api_key"). */
  readonly key: string;
  /** The secret value. Set via ENV only. */
  readonly value: string;
  /** Where to send the key. Default: "header". */
  readonly location: "header" | "query";
}

/**
 * OAuth 2.0.
 * Only `client_credentials` is fully supported server-side.
 * `authorization_code` requires a browser redirect — use the
 * session-based auth system for that flow instead.
 */
export interface OAuth2AuthConfig {
  readonly type: "oauth2";
  readonly grantType: "client_credentials" | "authorization_code";
  readonly clientId: string;
  /** Secret — set via ENV only. */
  readonly clientSecret: string;
  /** Token endpoint URL (e.g. https://keycloak/realms/z2lab/protocol/openid-connect/token). */
  readonly tokenUrl: string;
  readonly scopes?: readonly string[];
}

/**
 * HTTP Digest Authentication (RFC 7616).
 *
 * ⚠️  Digest is a CHALLENGE-RESPONSE protocol — two requests are required:
 *   1. Initial request (no auth header) → server returns 401 + WWW-Authenticate.
 *   2. Client calls authService.updateDigestChallenge(wwwAuthenticateHeader).
 *   3. Retry request → DigestStrategy computes and attaches the Authorization header.
 *
 * The HTTP client (FhirClient) handles this 2-step flow transparently.
 */
export interface DigestAuthConfig {
  readonly type: "digest";
  readonly username: string;
  readonly password: string;
}

/** Explicitly no authentication. Used as the safe default. */
export interface NoAuthConfig {
  readonly type: "none";
}

export type AuthConfig =
  | BearerAuthConfig
  | BasicAuthConfig
  | ApiKeyAuthConfig
  | OAuth2AuthConfig
  | DigestAuthConfig
  | NoAuthConfig;

/** All valid auth type strings — useful for validation and dropdowns. */
export const AUTH_TYPES = ["none", "bearer", "basic", "apiKey", "oauth2", "digest"] as const;
export type AuthType = AuthConfig["type"];
