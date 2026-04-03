import type { IAuthStrategy, AuthResult } from "./IAuthStrategy";
import type { ApiKeyAuthConfig } from "../types/AuthConfig";

/**
 * API Key authentication — sends an arbitrary key-value pair either as
 * a custom request header or as a URL query parameter.
 *
 * Use for:
 *   - Prometheus /metrics scraper (METRICS_TOKEN → Authorization: Bearer)
 *   - SASIS / GLN APIs that require an X-Api-Key header
 *   - Grafana HTTP API (Authorization: Bearer <token> or api_key= query)
 *
 * ENV vars (FHIR):
 *   FHIR_AUTH_TYPE=apiKey
 *   FHIR_AUTH_API_KEY_NAME=X-Api-Key
 *   FHIR_AUTH_API_KEY_VALUE=<secret>
 *   FHIR_AUTH_API_KEY_LOCATION=header   (or "query")
 */
export class ApiKeyStrategy implements IAuthStrategy {
  private readonly config: ApiKeyAuthConfig;

  constructor(config: ApiKeyAuthConfig) {
    if (!config.key)   throw new Error("ApiKeyStrategy: key must not be empty");
    if (!config.value) throw new Error("ApiKeyStrategy: value must not be empty");
    this.config = config;
  }

  async apply(_url: string, _method: string): Promise<AuthResult> {
    if (this.config.location === "query") {
      return { headers: {}, searchParams: { [this.config.key]: this.config.value } };
    }
    return { headers: { [this.config.key]: this.config.value }, searchParams: {} };
  }
}
