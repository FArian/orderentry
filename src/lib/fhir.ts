export type FhirCoding = { system: string; code: string; display?: string };
export type ValueSetSummary = { url: string; name?: string; title?: string };
export type ValueSetExpansion = { system: string; code: string; display?: string };
export type SpecimenChoice = { code: FhirCoding; label: string; id: string };
export type ActivityDefinition = {
  resourceType: "ActivityDefinition";
  id?: string;
  url?: string;
  identifier?: Array<{ system?: string; value?: string }>;
  name?: string;
  title?: string;
  subtitle?: string;
  status?: string;
  description?: string;
  /**
   * Server may return a single topic or an array; coding.display is what we render in tabs.
   */
  topic?:
    | { coding?: FhirCoding[]; text?: string }
    | Array<{ coding?: FhirCoding[]; text?: string }>;
  kind?: string;
  code?: { coding?: FhirCoding[] };
  /** Minimal extension typing for values used in UI */
  extension?: Array<
    | {
        url: string;
        valueQuantity?: { value?: number; unit?: string; system?: string; code?: string };
      }
    | {
        url: string;
        valueReference?: { identifier?: { system?: string; value?: string } };
      }
  >;
  location?: { identifier?: { system?: string; value?: string } };
  observationResultRequirement?: Array<{ reference?: string; display?: string }>;
  contained?: unknown[];
  useContext?: Array<{
    code?: { system?: string; code?: string };
    valueReference?: { reference?: string };
  }>;
};

export type ObservationDefinition = {
  resourceType: "ObservationDefinition";
  id?: string;
  code?: { coding?: FhirCoding[]; text?: string };
  preferredReportName?: string;
  permittedDataType?: string[];
  quantitativeDetails?: { unit?: { coding?: FhirCoding[]; text?: string } };
};

export type SpecimenDefinition = {
  resourceType: "SpecimenDefinition";
  id?: string;
  typeCollected?: { text?: string; coding?: FhirCoding[] };
  container?: Array<{
    description?: string;
    capacity?: { value?: number; unit?: string; code?: string; system?: string };
    additive?: Array<{ additiveCodeableConcept?: { coding?: FhirCoding[]; text?: string } }>;
  }>;
};

export type SpecimenDefinitionSearchBundle = FhirBundle<SpecimenDefinition>;

import { fhirBase } from "@/config";

export const FHIR_BASE: string = fhirBase;

/** Business-identifier NamingSystem URIs derived from the configured FHIR base URL.
 *  Changing FHIR_BASE_URL propagates to all stored identifiers automatically.
 *  NOTE: StructureDefinition extension URLs are NOT here — they are canonical
 *  organisation URIs (zetlab.ch) baked into the ActivityDefinition resources
 *  in FHIR and must not change with the server URL. */
export const FHIR_SYSTEMS = {
  orderNumbers: `${FHIR_BASE}/order-numbers`,
  specimen:     `${FHIR_BASE}/specimen`,
  ik:           `${FHIR_BASE}/ik`,
  vnr:          `${FHIR_BASE}/vnr`,
} as const;

/** Canonical extension URLs as stored in ActivityDefinition resources.
 *  These are organisation-level URIs (zetlab.ch), independent of FHIR server. */
export const FHIR_EXT = {
  minimalVolume:     "https://www.zetlab.ch/fhir/StructureDefinition/minimal-volume-microliter",
  specimenDefinition:"https://www.zetlab.ch/StructureDefinition/specimen-definition",
} as const;

export async function handleResponse(res: Response): Promise<unknown | string> {
  if (!res.ok) {
    let text = "Request failed";
    try {
      text = await res.text();
    } catch {}
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) return res.json();
  return res.text();
}

/** Proxy base: routes browser FHIR calls through Next.js server (/api/fhir → EnvConfig.fhirBaseUrl).
 *  Server-side calls (API routes, server components) also work — they reach the same endpoint.
 *  FHIR_BASE is kept for identifier system URIs (FHIR_SYSTEMS) only — not for HTTP calls. */
const FHIR_PROXY_BASE = "/api/fhir";

export async function fhirGet(path: string, init?: RequestInit) {
  const url = `${FHIR_PROXY_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/fhir+json" },
    cache: "no-store",
    ...init,
  });
  return handleResponse(res);
}

export async function fhirPost(path: string, body: Record<string, unknown>, init?: RequestInit) {
  const url = `${FHIR_PROXY_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/fhir+json",
      "content-type": "application/fhir+json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    ...init,
  });
  return handleResponse(res);
}

export type FhirMeta = { lastUpdated?: string; versionId?: string };
export type FhirBundleLink = { relation?: string; url?: string };
export type FhirBundleEntry<T = unknown> = {
  fullUrl?: string;
  resource?: T;
  search?: { mode?: string };
};
export type FhirBundle<T = unknown> = {
  resourceType: "Bundle";
  id?: string;
  meta?: FhirMeta;
  type?: string;
  total?: number;
  link?: FhirBundleLink[];
  entry?: Array<FhirBundleEntry<T>>;
};

/** Specific type for ActivityDefinition search bundle response */
export type ActivityDefinitionSearchBundle = FhirBundle<ActivityDefinition>;

export function isBundle(r: unknown): r is FhirBundle<unknown> {
  return (
    typeof r === "object" &&
    r !== null &&
    "resourceType" in r &&
    (r as { resourceType?: unknown }).resourceType === "Bundle"
  );
}

export async function fetchActivityAndObservation(system: string, code: string): Promise<{
  activity?: ActivityDefinition;
  observation?: ObservationDefinition;
}> {
  // Try to include related definitions when server supports it
  const qs = new URLSearchParams();
  if (system && code) qs.set("code", `${system}|${code}`);
  else if (code) qs.set("code", code);
  qs.set("_count", "5");
  // Broad include to maximize chance of getting ObservationDefinition
  qs.set("_include", "*");
  const path = `/ActivityDefinition?${qs.toString()}`;
  const bundle = await fhirGet(path);
  if (!isBundle(bundle)) return {};
  const entries: Array<{ resource?: unknown }> = bundle.entry || [];
  const ads: ActivityDefinition[] = entries
    .map((e) => e.resource)
    .filter(
      (r): r is ActivityDefinition =>
        typeof r === "object" &&
        r !== null &&
        "resourceType" in r &&
        (r as { resourceType?: unknown }).resourceType === "ActivityDefinition"
    );
  const obsList: ObservationDefinition[] = entries
    .map((e) => e.resource)
    .filter(
      (r): r is ObservationDefinition =>
        typeof r === "object" &&
        r !== null &&
        "resourceType" in r &&
        (r as { resourceType?: unknown }).resourceType === "ObservationDefinition"
    );

  const activity = ads[0];
  let observation = obsList[0];

  // If not included, check contained resources referenced via observationResultRequirement
  if (!observation && activity?.contained && activity.observationResultRequirement?.length) {
    const localRef = activity.observationResultRequirement[0]?.reference; // e.g. "#obs1"
    if (localRef && localRef.startsWith("#")) {
      const id = localRef.slice(1);
      const match = activity.contained.find((c): c is ObservationDefinition => {
        return (
          typeof c === "object" &&
          c !== null &&
          "resourceType" in c &&
          (c as { resourceType?: unknown }).resourceType === "ObservationDefinition" &&
          "id" in c &&
          (c as { id?: unknown }).id === id
        );
      });
      if (match) observation = match;
    }
  }

  // Fallback: try direct ObservationDefinition by id if code looks like a plausible id
  if (!observation && code) {
    try {
      const direct = (await fhirGet(`/ObservationDefinition/${encodeURIComponent(code)}`)) as ObservationDefinition;
      if (direct && direct.resourceType === "ObservationDefinition") {
        observation = direct;
      }
    } catch {
      // ignore
    }
  }

  return {
    ...(activity    !== undefined && { activity }),
    ...(observation !== undefined && { observation }),
  };
}
