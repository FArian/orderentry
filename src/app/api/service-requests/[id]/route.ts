import { NextRequest, NextResponse } from "next/server";
import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import { ordersController } from "@/infrastructure/api/controllers/OrdersController";

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
  const result = await ordersController.delete(id);
  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
