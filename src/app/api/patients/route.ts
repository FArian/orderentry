import { NextResponse } from "next/server";
import { FHIR_BASE } from "@/lib/fhir";

interface PatientOut {
  id: string;
  name: string;
  address: string;
  createdAt: string;
}

type FhirHumanName = {
  use?: string;
  text?: string;
  given?: string[];
  family?: string;
};

type FhirAddress = {
  use?: string;
  type?: string;
  text?: string;
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type FhirPatient = {
  resourceType: "Patient";
  id?: string;
  name?: FhirHumanName[];
  address?: FhirAddress[];
  birthDate?: string;
  meta?: { lastUpdated?: string; versionId?: string };
};

type FhirBundle = {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource?: FhirPatient }>;
};


function nameToString(n?: FhirHumanName[]): string {
  if (!n || n.length === 0) return "Unknown";
  const first = n[0];
  if (first.text && first.text.trim()) return first.text.trim();
  const parts = [
    ...(first.given || []).filter(Boolean),
    first.family || "",
  ].filter(Boolean);
  return parts.join(" ") || "Unknown";
}

function addressToString(a?: FhirAddress[]): string {
  if (!a || a.length === 0) return "";
  const first = a[0];
  if (first.text && first.text.trim()) return first.text.trim();
  const parts = [
    ...(first.line || []),
    first.city,
    first.state,
    first.postalCode,
    first.country,
  ].filter(Boolean);
  return parts.join(", ");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10));
  const showInactive = searchParams.get("showInactive") === "true";

  const offset = (page - 1) * pageSize;

  // Page query — filter by active state
  const url = new URL(`${FHIR_BASE}/Patient`);
  if (q) url.searchParams.set("name", q);
  if (!showInactive) url.searchParams.set("active", "true");
  else url.searchParams.set("active", "false");
  url.searchParams.set("_count", String(pageSize));
  url.searchParams.set("_getpagesoffset", String(offset));
  url.searchParams.set("_sort", "-_lastUpdated");

  // Separate count query
  const countUrl = new URL(`${FHIR_BASE}/Patient`);
  if (q) countUrl.searchParams.set("name", q);
  if (!showInactive) countUrl.searchParams.set("active", "true");
  else countUrl.searchParams.set("active", "false");
  countUrl.searchParams.set("_summary", "count");
  countUrl.searchParams.set("_total", "accurate");

  let data: PatientOut[] = [];
  let total = 0;
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
    const bundle = (await res.json()) as FhirBundle;
    // Prefer the count response's total when available
    if (countRes.ok) {
      const countBundle = (await countRes.json()) as FhirBundle;
      total = countBundle.total ?? bundle.total ?? 0;
    } else {
      total = bundle.total ?? 0;
    }
    const entries = bundle.entry || [];
    data = entries
      .map((e) => e.resource)
      .filter((r): r is FhirPatient => !!r && r.resourceType === "Patient" && !!r.id)
      .map((p): PatientOut => ({
        id: p.id as string,
        name: nameToString(p.name),
        address: addressToString(p.address),
        createdAt: p.meta?.lastUpdated || "",
      }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { data: [], total: 0, page, pageSize, error: message || "Network error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, total, page, pageSize });
}
