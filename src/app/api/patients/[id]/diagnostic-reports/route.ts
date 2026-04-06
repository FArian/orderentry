import { NextResponse } from "next/server";
import { FHIR_BASE } from "@/lib/fhir";
import { getSessionFromCookies } from "@/lib/auth";

type FhirCoding = { system?: string; code?: string; display?: string };
type FhirCodeableConcept = { text?: string; coding?: FhirCoding[] };
type FhirAttachment = { contentType?: string; data?: string; title?: string; language?: string };
type FhirDiagnosticReport = {
  resourceType: "DiagnosticReport";
  id?: string;
  status?: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  effectiveDateTime?: string;
  issued?: string;
  basedOn?: Array<{ reference?: string }>;
  result?: Array<{ reference?: string; display?: string }>;
  conclusion?: string;
  presentedForm?: FhirAttachment[];
  meta?: { lastUpdated?: string };
};

type FhirBundle<T = unknown> = {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource?: T }>;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const url = new URL(`${FHIR_BASE}/DiagnosticReport`);
    url.searchParams.set("subject", `Patient/${encodeURIComponent(id)}`);
    url.searchParams.set("_sort", "-_lastUpdated");
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

    const bundle = (await res.json()) as FhirBundle<FhirDiagnosticReport>;
    const entries = bundle.entry || [];
    const data = entries
      .map((e) => e.resource)
      .filter((r): r is FhirDiagnosticReport => !!r && r.resourceType === "DiagnosticReport" && !!r.id)
      .map((dr) => {
        const forms = dr.presentedForm || [];
        const pdf = forms.find((f) => (f.contentType || "").toLowerCase().includes("pdf"));
        const hl7form = forms.find((f) => (f.contentType || "").toLowerCase().includes("hl7"));
        return {
          id: dr.id as string,
          status: dr.status || "",
          codeText: dr.code?.text || dr.code?.coding?.[0]?.display || "",
          category: dr.category?.[0]?.text || dr.category?.[0]?.coding?.[0]?.display || "",
          effectiveDate: dr.effectiveDateTime || dr.issued || dr.meta?.lastUpdated || "",
          resultCount: Array.isArray(dr.result) ? dr.result.length : 0,
          conclusion: dr.conclusion || "",
          basedOn: (dr.basedOn || []).map((r) => r.reference || "").filter(Boolean),
          pdfData: pdf?.data || null,
          pdfTitle: pdf?.title || null,
          hl7Data: hl7form?.data || null,
          hl7Title: hl7form?.title || null,
        };
      });

    return NextResponse.json({ data, total: bundle.total ?? data.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { data: [], total: 0, error: message || "Network error" },
      { status: 500 }
    );
  }
}
