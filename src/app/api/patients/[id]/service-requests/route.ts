import { NextResponse } from "next/server";
import { FHIR_BASE, FHIR_SYSTEMS } from "@/lib/fhir";
import { getSessionFromCookies } from "@/lib/auth";

type FhirIdentifier = { system?: string; value?: string; type?: { text?: string } };
type FhirCodeableConcept = { text?: string; coding?: Array<{ system?: string; code?: string; display?: string }> };
type FhirServiceRequest = {
  resourceType: "ServiceRequest";
  id?: string;
  status?: string;
  intent?: string;
  code?: FhirCodeableConcept;
  authoredOn?: string;
  identifier?: FhirIdentifier[];
  specimen?: Array<{ reference?: string; identifier?: { system?: string; value?: string } }>;
  meta?: { lastUpdated?: string };
};

type FhirBundle<T = unknown> = {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource?: T }>;
};

function extractOrderNumber(ids?: FhirIdentifier[]): string | undefined {
  if (!ids) return undefined;
  const preferred = ids.find((i) => i.system === FHIR_SYSTEMS.orderNumbers);
  if (preferred?.value) return preferred.value;
  return ids.find((i) => i.value)?.value;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const url = new URL(`${FHIR_BASE}/ServiceRequest`);
    // FHIR searches typically reference the full resource, e.g., "Patient/{id}"
    url.searchParams.set("subject", `Patient/${encodeURIComponent(id)}`);
    // Sort newest first when supported
    url.searchParams.set("_sort", "-_lastUpdated");
    // Reasonable page size
    url.searchParams.set("_count", "50");

    const res = await fetch(url.toString(), {
      headers: { accept: "application/fhir+json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { data: [], total: 0, error: `FHIR error: ${res.status}` },
        { status: res.status }
      );
    }

    const bundle = (await res.json()) as FhirBundle<FhirServiceRequest>;
    const entries = bundle.entry || [];
    const data = entries
      .map((e) => e.resource)
      .filter((r): r is FhirServiceRequest => !!r && r.resourceType === "ServiceRequest" && !!r.id)
      .map((sr) => ({
        id: sr.id as string,
        status: sr.status || "",
        intent: sr.intent || "",
        codeText: sr.code?.text || sr.code?.coding?.[0]?.display || "",
        authoredOn: sr.authoredOn || sr.meta?.lastUpdated || "",
        orderNumber: extractOrderNumber(sr.identifier) || "",
        specimenCount: Array.isArray(sr.specimen) ? sr.specimen.length : 0,
      }));

    return NextResponse.json({ data, total: bundle.total ?? data.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { data: [], total: 0, error: message || "Network error" },
      { status: 500 }
    );
  }
}

