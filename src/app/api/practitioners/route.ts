import { NextResponse } from "next/server";
import { FHIR_BASE } from "@/lib/fhir";

type FhirHumanName = {
  use?: string;
  text?: string;
  given?: string[];
  family?: string;
  prefix?: string[];
};

type FhirPractitioner = {
  resourceType: "Practitioner";
  id?: string;
  name?: FhirHumanName[];
};

type FhirBundle = {
  resourceType: "Bundle";
  entry?: Array<{ resource?: FhirPractitioner }>;
};

function nameToString(n?: FhirHumanName[]): string {
  if (!n || n.length === 0) return "";
  const first = n[0];
  if (!first) return "";
  if (first.text?.trim()) return first.text.trim();
  const parts = [
    ...(first.prefix || []),
    ...(first.given || []),
    first.family || "",
  ].filter(Boolean);
  return parts.join(" ") || "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  const url = new URL(`${FHIR_BASE}/Practitioner`);
  if (q) url.searchParams.set("name", q);
  url.searchParams.set("_count", "20");

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: "application/fhir+json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ data: [] }, { status: res.status });
    }
    const bundle = (await res.json()) as FhirBundle;
    const data = (bundle.entry || [])
      .map((e) => e.resource)
      .filter((r): r is FhirPractitioner => !!r && r.resourceType === "Practitioner" && !!r.id)
      .map((p) => ({ id: p.id as string, name: nameToString(p.name) }))
      .filter((p) => p.name);

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: [], error: message }, { status: 500 });
  }
}
