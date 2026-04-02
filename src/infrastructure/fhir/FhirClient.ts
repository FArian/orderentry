/**
 * Server-side FHIR client used inside Next.js API routes.
 * Do NOT import this on the client side — it reads server-only env vars.
 *
 * FHIR_BASE is sourced from src/config.ts (single source of truth).
 * When FHIR_BASE_URL is not set, config.ts falls back to the nip.io server.
 * In Docker, FHIR_BASE_URL is set via the container environment.
 */
import { fhirBase } from "@/config";

export const FHIR_BASE: string = fhirBase;

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
  const res = await fetch(url.toString(), {
    headers: { accept: "application/fhir+json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FHIR ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

/**
 * Posts a FHIR transaction or batch bundle to the server root.
 * Server-side only — do NOT import this on the client.
 */
export async function fhirTransaction<T>(
  bundle: Record<string, unknown>,
): Promise<T> {
  const url = `${FHIR_BASE}/`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/fhir+json",
      accept: "application/fhir+json",
    },
    body: JSON.stringify(bundle),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FHIR transaction ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
