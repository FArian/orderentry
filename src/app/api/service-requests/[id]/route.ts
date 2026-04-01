import { NextRequest, NextResponse } from "next/server";
import { FHIR_BASE } from "@/lib/fhir";

async function fhirHeaders() {
  return { accept: "application/fhir+json", "content-type": "application/fhir+json" };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await fetch(`${FHIR_BASE}/ServiceRequest/${id}`, {
      headers: await fhirHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `FHIR error: ${res.status}` }, { status: res.status });
    }
    const sr = await res.json();
    return NextResponse.json(sr);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const res = await fetch(`${FHIR_BASE}/ServiceRequest/${id}`, {
      method: "PUT",
      headers: await fhirHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `FHIR error: ${res.status}`, detail: text }, { status: res.status });
    }
    const result = await res.json();
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Try hard DELETE first
    const res = await fetch(`${FHIR_BASE}/ServiceRequest/${id}`, {
      method: "DELETE",
      headers: { accept: "application/fhir+json" },
    });
    if (res.ok || res.status === 204) {
      return NextResponse.json({ deleted: true });
    }
    // 409 = referential integrity violation (linked Specimen/Encounter/DocumentReference)
    // Fall back to FHIR soft-delete: set status → entered-in-error
    if (res.status === 409) {
      const getRes = await fetch(`${FHIR_BASE}/ServiceRequest/${id}`, {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!getRes.ok) {
        return NextResponse.json({ error: `FHIR error: ${getRes.status}` }, { status: getRes.status });
      }
      const sr = (await getRes.json()) as Record<string, unknown>;
      const updated = { ...sr, status: "entered-in-error" };
      const putRes = await fetch(`${FHIR_BASE}/ServiceRequest/${id}`, {
        method: "PUT",
        headers: { accept: "application/fhir+json", "content-type": "application/fhir+json" },
        body: JSON.stringify(updated),
      });
      if (!putRes.ok) {
        const detail = await putRes.text();
        return NextResponse.json({ error: `FHIR error: ${putRes.status}`, detail }, { status: putRes.status });
      }
      return NextResponse.json({ deleted: true, soft: true });
    }
    return NextResponse.json({ error: `FHIR error: ${res.status}` }, { status: res.status });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error" },
      { status: 500 }
    );
  }
}
