import { NextRequest, NextResponse } from "next/server";
import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import { ordersController } from "@/infrastructure/api/controllers/OrdersController";
import { buildOperationOutcome } from "@/infrastructure/fhir/FhirTypes";

const FHIR_CONTENT_TYPE = "application/fhir+json";
const FHIR_HEADERS = { accept: "application/fhir+json", "content-type": "application/fhir+json" };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const res = await fetch(`${FHIR_BASE}/ServiceRequest/${id}`, {
      headers: FHIR_HEADERS,
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        buildOperationOutcome("error", "not-found", `FHIR error: ${res.status}`),
        { status: res.status, headers: { "content-type": FHIR_CONTENT_TYPE } },
      );
    }
    const sr = await res.json();
    return NextResponse.json(sr, { headers: { "content-type": FHIR_CONTENT_TYPE } });
  } catch (err: unknown) {
    return NextResponse.json(
      buildOperationOutcome("error", "exception", err instanceof Error ? err.message : "Network error"),
      { status: 500, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const res = await fetch(`${FHIR_BASE}/ServiceRequest/${id}`, {
      method: "PUT",
      headers: FHIR_HEADERS,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        buildOperationOutcome("error", "exception", `FHIR error: ${res.status}: ${text.slice(0, 200)}`),
        { status: res.status, headers: { "content-type": FHIR_CONTENT_TYPE } },
      );
    }
    const result = await res.json();
    return NextResponse.json(result, { headers: { "content-type": FHIR_CONTENT_TYPE } });
  } catch (err: unknown) {
    return NextResponse.json(
      buildOperationOutcome("error", "exception", err instanceof Error ? err.message : "Network error"),
      { status: 500, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await ordersController.delete(id);
  const httpStatus = result.httpStatus ?? 200;
  const { httpStatus: _, ...body } = result;
  if (result.deleted) {
    return NextResponse.json(
      buildOperationOutcome("information", "informational", `ServiceRequest/${id} deleted`),
      { status: 200, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }
  return NextResponse.json(
    buildOperationOutcome("error", "exception", body.error ?? "Delete failed"),
    { status: httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } },
  );
}
