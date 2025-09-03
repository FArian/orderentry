import { NextResponse } from "next/server";

const FHIR_BASE = "https://hapi.fhir.org/baseR4";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const url = new URL(`${FHIR_BASE}/Patient/${encodeURIComponent(id)}`);
    const res = await fetch(url.toString(), {
      headers: { accept: "application/fhir+json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `FHIR error: ${res.status}` },
        { status: res.status }
      );
    }
    const resource = await res.json();
    return NextResponse.json(resource);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || "Network error" }, { status: 500 });
  }
}
