/**
 * Builds the AuthConfig for outbound FHIR requests from server-side ENV vars.
 *
 * Called once at module load in FhirClient.ts.
 * All values come from EnvConfig (process.env) — never from the browser.
 *
 * Quick reference — set in .env.local / docker-compose.yml:
 *
 *   No auth (default):
 *     FHIR_AUTH_TYPE=none
 *
 *   Bearer token:
 *     FHIR_AUTH_TYPE=bearer
 *     FHIR_AUTH_TOKEN=eyJhbGci...
 *
 *   Basic auth:
 *     FHIR_AUTH_TYPE=basic
 *     FHIR_AUTH_USER=admin
 *     FHIR_AUTH_PASSWORD=secret
 *
 *   API Key (header):
 *     FHIR_AUTH_TYPE=apiKey
 *     FHIR_AUTH_API_KEY_NAME=X-Api-Key
 *     FHIR_AUTH_API_KEY_VALUE=mykey
 *     FHIR_AUTH_API_KEY_LOCATION=header
 *
 *   OAuth2 client_credentials (Keycloak / SMART on FHIR):
 *     FHIR_AUTH_TYPE=oauth2
 *     FHIR_AUTH_CLIENT_ID=z2lab-backend
 *     FHIR_AUTH_CLIENT_SECRET=secret
 *     FHIR_AUTH_TOKEN_URL=https://keycloak/realms/z2lab/protocol/openid-connect/token
 *     FHIR_AUTH_SCOPES=fhir/read fhir/write
 *
 *   Digest auth:
 *     FHIR_AUTH_TYPE=digest
 *     FHIR_AUTH_USER=admin
 *     FHIR_AUTH_PASSWORD=secret
 */

import { EnvConfig } from "../config/EnvConfig";
import type { AuthConfig } from "./types/AuthConfig";
import { AuthorizationService } from "./AuthorizationService";

function buildFhirAuthConfig(): AuthConfig {
  const type = EnvConfig.fhirAuthType;

  if (type === "bearer") {
    return { type: "bearer", token: EnvConfig.fhirAuthToken };
  }
  if (type === "basic") {
    return { type: "basic", username: EnvConfig.fhirAuthUser, password: EnvConfig.fhirAuthPassword };
  }
  if (type === "apiKey") {
    return {
      type: "apiKey",
      key: EnvConfig.fhirAuthApiKeyName,
      value: EnvConfig.fhirAuthApiKeyValue,
      location: EnvConfig.fhirAuthApiKeyLocation,
    };
  }
  if (type === "oauth2") {
    const scopeStr = EnvConfig.fhirAuthScopes;
    const base = {
      type: "oauth2" as const,
      grantType: "client_credentials" as const,
      clientId: EnvConfig.fhirAuthClientId,
      clientSecret: EnvConfig.fhirAuthClientSecret,
      tokenUrl: EnvConfig.fhirAuthTokenUrl,
    };
    return scopeStr
      ? { ...base, scopes: scopeStr.split(/\s+/).filter(Boolean) as readonly string[] }
      : base;
  }
  if (type === "digest") {
    return { type: "digest", username: EnvConfig.fhirAuthUser, password: EnvConfig.fhirAuthPassword };
  }

  return { type: "none" };
}

/**
 * Singleton AuthorizationService for all outbound FHIR requests.
 * Initialized once from ENV vars at module load time.
 */
export const fhirAuthService = new AuthorizationService(buildFhirAuthConfig());
