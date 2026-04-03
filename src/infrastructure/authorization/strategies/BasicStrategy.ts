import type { IAuthStrategy, AuthResult } from "./IAuthStrategy";
import type { BasicAuthConfig } from "../types/AuthConfig";

/**
 * RFC 7617 HTTP Basic Authentication.
 *
 * Injects: `Authorization: Basic base64(username:password)`
 *
 * Use for:
 *   - HAPI FHIR with basic auth proxy in front (e.g. Traefik BasicAuth middleware)
 *   - Legacy REST services, HL7 SOAP gateways, Labsoft APIs
 *
 * ENV vars (FHIR): FHIR_AUTH_TYPE=basic, FHIR_AUTH_USER=<user>, FHIR_AUTH_PASSWORD=<pass>
 *
 * ⚠️  Only use over HTTPS — credentials are base64-encoded, NOT encrypted.
 */
export class BasicStrategy implements IAuthStrategy {
  private readonly header: string;

  constructor(config: BasicAuthConfig) {
    if (!config.username) throw new Error("BasicStrategy: username must not be empty");
    const encoded = Buffer.from(`${config.username}:${config.password}`).toString("base64");
    this.header = `Basic ${encoded}`;
  }

  async apply(_url: string, _method: string): Promise<AuthResult> {
    return { headers: { Authorization: this.header }, searchParams: {} };
  }
}
