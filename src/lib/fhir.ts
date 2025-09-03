export type FhirCoding = { system: string; code: string; display?: string };
export type ValueSetSummary = { url: string; name?: string; title?: string };
export type ValueSetExpansion = { system: string; code: string; display?: string };
export type SpecimenChoice = { code: FhirCoding; label: string; id: string };
export type ActivityDefinition = {
  resourceType: "ActivityDefinition";
  id?: string;
  name?: string;
  title?: string;
  kind?: string;
  code?: { coding?: FhirCoding[] };
  observationResultRequirement?: Array<{ reference?: string; display?: string }>;
  contained?: unknown[];
};

export type ObservationDefinition = {
  resourceType: "ObservationDefinition";
  id?: string;
  code?: { coding?: FhirCoding[]; text?: string };
  preferredReportName?: string;
  permittedDataType?: string[];
  quantitativeDetails?: { unit?: { coding?: FhirCoding[]; text?: string } };
};

export const FHIR_BASE: string =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FHIR_BASE) ||
  "https://hapi.fhir.org/baseR4";

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

export async function fhirGet(path: string, init?: RequestInit) {
  const url = `${FHIR_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/fhir+json" },
    cache: "no-store",
    ...init,
  });
  return handleResponse(res);
}

export async function fhirPost(path: string, body: Record<string, unknown>, init?: RequestInit) {
  const url = `${FHIR_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
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

export type FhirBundle<T = unknown> = { resourceType: "Bundle"; entry?: Array<{ resource?: T }> };

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

  return { activity, observation };
}
