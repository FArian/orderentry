import { NextResponse } from "next/server";
import { FHIR_BASE } from "@/lib/fhir";

type FhirCoding = { system?: string; code?: string; display?: string };
type FhirCodeableConcept = { text?: string; coding?: FhirCoding[] };
type FhirAttachment = { contentType?: string; data?: string; title?: string };
type FhirDiagnosticReport = {
  resourceType: "DiagnosticReport";
  id?: string;
  status?: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: { reference?: string; display?: string };
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

function extractPatientId(subject?: { reference?: string }): string {
  const ref = subject?.reference || "";
  return ref.startsWith("Patient/") ? ref.slice("Patient/".length) : ref;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10));
  const status = (searchParams.get("status") || "").trim();

  const offset = (page - 1) * pageSize;

  const url = new URL(`${FHIR_BASE}/DiagnosticReport`);
  if (q) url.searchParams.set("code", q);
  if (status) url.searchParams.set("status", status);
  url.searchParams.set("_sort", "-_lastUpdated");
  url.searchParams.set("_count", String(pageSize));
  url.searchParams.set("_getpagesoffset", String(offset));

  // Separate count query
  const countUrl = new URL(`${FHIR_BASE}/DiagnosticReport`);
  if (q) countUrl.searchParams.set("code", q);
  if (status) countUrl.searchParams.set("status", status);
  countUrl.searchParams.set("_summary", "count");
  countUrl.searchParams.set("_total", "accurate");

  try {
    const [res, countRes] = await Promise.all([
      fetch(url.toString(), { headers: { accept: "application/fhir+json" }, cache: "no-store" }),
      fetch(countUrl.toString(), { headers: { accept: "application/fhir+json" }, cache: "no-store" }),
    ]);

    if (!res.ok) {
      return NextResponse.json(
        { data: [], total: 0, page, pageSize, error: `FHIR error: ${res.status}` },
        { status: res.status }
      );
    }

    const bundle = (await res.json()) as FhirBundle<FhirDiagnosticReport>;
    let total = bundle.total ?? 0;
    if (countRes.ok) {
      const countBundle = (await countRes.json()) as FhirBundle;
      total = countBundle.total ?? total;
    }

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
          patientId: extractPatientId(dr.subject),
          patientDisplay: dr.subject?.display || "",
          pdfData: pdf?.data || null,
          pdfTitle: pdf?.title || null,
          hl7Data: hl7form?.data || null,
          hl7Title: hl7form?.title || null,
        };
      });

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { data: [], total: 0, page, pageSize, error: message || "Network error" },
      { status: 500 }
    );
  }
}
