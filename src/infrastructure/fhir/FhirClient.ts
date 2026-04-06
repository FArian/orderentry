/**
 * Server-side FHIR client used inside Next.js API routes.
 * Do NOT import this on the client side — it reads server-only env vars.
 *
 * Authentication:
 *   Controlled by FHIR_AUTH_TYPE (+ type-specific vars). Default: "none".
 *   For Digest auth the client automatically handles the 2-step challenge-
 *   response handshake. For OAuth2, tokens are cached and refreshed.
 *   See src/infrastructure/authorization/fhirAuthConfig.ts for ENV var docs.
 *
 * Observability:
 *   Every request is recorded in PrometheusService with resource type, method,
 *   HTTP status, and duration. OpenTelemetry auto-instrumentations handle
 *   trace context propagation automatically when ENABLE_TRACING=true.
 */
import { EnvConfig }          from "../config/EnvConfig";
import { prometheusService } from "../metrics/PrometheusService";
import { fhirAuthService }   from "../authorization/fhirAuthConfig";
import { applyAuth }         from "../authorization/AuthorizationService";

export const FHIR_BASE: string = EnvConfig.fhirBaseUrl;

const BASE_FHIR_HEADERS: Record<string, string> = { accept: "application/fhir+json" };

/** Extract the FHIR resource type from a path, e.g. "/Patient/p-1" → "Patient". */
function extractResource(path: string): string {
  const segment = path.replace(/^\//, "").split("/")[0] ?? "";
  return segment || "unknown";
}

/**
 * Execute a fetch call with automatic Digest retry and Prometheus recording.
 * Returns the parsed JSON body on success; throws on error.
 */
async function executeFhirRequest<T>(
  url: string,
  method: string,
  init: RequestInit,
  resource: string,
  startMs: number,
): Promise<T> {
  const { url: authUrl, headers } = await applyAuth(fhirAuthService, url, method, BASE_FHIR_HEADERS);
  const mergedInit = { ...init, headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) } };

  let res = await fetch(authUrl, mergedInit);

  // Digest challenge-response: retry once after feeding the challenge
  if (res.status === 401) {
    const challenge = res.headers.get("www-authenticate") ?? "";
    if (challenge.toLowerCase().startsWith("digest ")) {
      fhirAuthService.updateDigestChallenge(challenge);
      const retried = await applyAuth(fhirAuthService, url, method, BASE_FHIR_HEADERS);
      res = await fetch(retried.url, { ...init, headers: retried.headers });
    }
    // OAuth2: invalidate token and retry once
    if (challenge.toLowerCase().startsWith("bearer ")) {
      fhirAuthService.invalidateOAuth2Token();
      const retried = await applyAuth(fhirAuthService, url, method, BASE_FHIR_HEADERS);
      res = await fetch(retried.url, { ...init, headers: retried.headers });
    }
  }

  prometheusService.recordFhirRequest(resource, method, String(res.status), (Date.now() - startMs) / 1000);
  if (!res.ok) throw new Error(`FHIR ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

export async function fhirGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(`${FHIR_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const resource = extractResource(path);
  const start    = Date.now();

  try {
    return await executeFhirRequest<T>(url.toString(), "GET", { cache: "no-store" }, resource, start);
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith("FHIR "))) {
      prometheusService.recordFhirRequest(resource, "GET", "error", (Date.now() - start) / 1000);
    }
    throw err;
  }
}

/**
 * Posts a FHIR transaction or batch bundle to the server root.
 * Server-side only — do NOT import this on the client.
 */
export async function fhirTransaction<T>(
  bundle: Record<string, unknown>,
): Promise<T> {
  const url      = `${FHIR_BASE}/`;
  const resource = "Bundle";
  const start    = Date.now();

  try {
    return await executeFhirRequest<T>(
      url,
      "POST",
      {
        method: "POST",
        headers: { "content-type": "application/fhir+json" },
        body: JSON.stringify(bundle),
        cache: "no-store",
      },
      resource,
      start,
    );
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith("FHIR "))) {
      prometheusService.recordFhirRequest(resource, "POST", "error", (Date.now() - start) / 1000);
    }
    throw err;
  }
}
