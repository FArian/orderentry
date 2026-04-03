import type { IAuthStrategy, AuthResult } from "./IAuthStrategy";
import type { BearerAuthConfig } from "../types/AuthConfig";

/**
 * RFC 6750 Bearer token authentication.
 *
 * Injects: `Authorization: Bearer <token>`
 *
 * Use for:
 *   - Orchestra JWT (already handled separately by JwtGuard for inbound)
 *   - External FHIR servers that require a static access token
 *   - REST APIs using opaque tokens or JWTs
 *
 * ENV vars (FHIR): FHIR_AUTH_TYPE=bearer, FHIR_AUTH_TOKEN=<token>
 */
export class BearerStrategy implements IAuthStrategy {
  private readonly header: string;

  constructor(config: BearerAuthConfig) {
    if (!config.token) throw new Error("BearerStrategy: token must not be empty");
    this.header = `Bearer ${config.token}`;
  }

  async apply(_url: string, _method: string): Promise<AuthResult> {
    return { headers: { Authorization: this.header }, searchParams: {} };
  }
}
