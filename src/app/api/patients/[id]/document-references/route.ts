import { NextResponse } from "next/server";
import { FHIR_BASE } from "@/lib/fhir";
import { getSessionFromCookies } from "@/lib/auth";

type FhirAttachment = {
  contentType?: string;
  data?: string;       // base64
  url?: string;
  title?: string;
  language?: string;
  creation?: string;
};

type FhirDocContent = {
  attachment: FhirAttachment;
  format?: { system?: string; code?: string; display?: string };
};

type FhirDocumentReference = {
  resourceType: "DocumentReference";
  id?: string;
  status?: string;
  docStatus?: string;
  type?: { text?: string; coding?: Array<{ code?: string; display?: string }> };
  description?: string;
  date?: string;
  author?: Array<{ display?: string; reference?: string }>;
  content?: FhirDocContent[];
  context?: {
    related?: Array<{ reference?: string }>;
  };
  meta?: { lastUpdated?: string };
};

type FhirBundle<T = unknown> = {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource?: T }>;
};

function extractContent(content?: FhirDocContent[]) {
  if (!Array.isArray(content)) return { pdf: null, hl7: null };
  let pdf: { data: string; title?: string } | null = null;
  let hl7: { data: string; title?: string } | null = null;
  for (const c of content) {
    const ct = (c.attachment?.contentType || "").toLowerCase();
    if (ct.includes("pdf") && c.attachment.data) {
      pdf = { data: c.attachment.data, ...(c.attachment.title !== undefined && { title: c.attachment.title }) };
    }
    if ((ct.includes("hl7") || ct.includes("x-hl7")) && c.attachment.data) {
      hl7 = { data: c.attachment.data, ...(c.attachment.title !== undefined && { title: c.attachment.title }) };
    }
  }
  return { pdf, hl7 };
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
    const url = new URL(`${FHIR_BASE}/DocumentReference`);
    url.searchParams.set("subject", `Patient/${encodeURIComponent(id)}`);
    url.searchParams.set("_sort", "-date");
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

    const bundle = (await res.json()) as FhirBundle<FhirDocumentReference>;
    const entries = bundle.entry || [];
    const data = entries
      .map((e) => e.resource)
      .filter((r): r is FhirDocumentReference => !!r && r.resourceType === "DocumentReference" && !!r.id)
      .map((dr) => {
        const { pdf, hl7 } = extractContent(dr.content);
        const related = (dr.context?.related || []).map((r) => r.reference || "").filter(Boolean);
        return {
          id: dr.id as string,
          status: dr.status || "",
          docStatus: dr.docStatus || "",
          typeText: dr.type?.text || dr.type?.coding?.[0]?.display || "",
          description: dr.description || "",
          date: dr.date || dr.meta?.lastUpdated || "",
          author: dr.author?.[0]?.display || "",
          hasPdf: !!pdf,
          hasHl7: !!hl7,
          pdfData: pdf?.data || null,
          pdfTitle: pdf?.title || null,
          hl7Data: hl7?.data || null,
          hl7Title: hl7?.title || null,
          related,
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
