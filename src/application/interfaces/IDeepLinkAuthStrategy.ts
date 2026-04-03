/**
 * IDeepLinkAuthStrategy — port for validating external deep-link tokens.
 *
 * Implementations (JWT, HMAC) live in infrastructure/deeplink/strategies/.
 * DeepLinkAuthStrategyFactory selects the correct strategy based on DEEPLINK_AUTH_TYPE.
 */

import type { DeepLinkContext } from "@/domain/entities/DeepLinkContext";

/** Structured validation failure returned by strategies. */
export interface DeepLinkAuthError {
  readonly code:    "MISSING_TOKEN" | "INVALID_TOKEN" | "EXPIRED_TOKEN" | "REPLAY_ATTACK" | "UNKNOWN_SYSTEM";
  readonly message: string;
}

/** Discriminated union result from strategy validation. */
export type DeepLinkAuthResult =
  | { readonly ok: true;  readonly context: DeepLinkContext }
  | { readonly ok: false; readonly error: DeepLinkAuthError };

/** Contract every deep-link auth strategy must satisfy. */
export interface IDeepLinkAuthStrategy {
  /**
   * Validate the raw token string from the request.
   * @param token  Raw token value from URL query parameter.
   * @param url    Full request URL (needed for HMAC canonical form).
   * @returns      DeepLinkAuthResult — ok=true with context, or ok=false with error.
   */
  validate(token: string, url: string): Promise<DeepLinkAuthResult>;
}
