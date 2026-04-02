import { NextResponse } from "next/server";
import { orderSubmitController } from "@/infrastructure/api/controllers/OrderSubmitController";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/submit
 *
 * Accepts a FHIR transaction bundle (Encounter + ServiceRequest + Specimen +
 * DocumentReference) from the browser and forwards it to HAPI FHIR server-side.
 *
 * Replaces the legacy direct fhirPost("/", bundle) call in OrderClient.tsx,
 * routing all FHIR writes through the Next.js server.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let bundle: Record<string, unknown>;
  try {
    bundle = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ids: [], error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const result = await orderSubmitController.submit(bundle);
  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
