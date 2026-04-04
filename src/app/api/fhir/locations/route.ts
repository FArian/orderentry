import { NextResponse } from "next/server";
import {
  fhirLocationsController,
  requireAdmin,
} from "@/infrastructure/api/controllers/FhirLocationsController";
import { buildOperationOutcome } from "@/infrastructure/fhir/FhirTypes";

export const dynamic = "force-dynamic";

const FHIR_CT = "application/fhir+json";

/** GET /api/fhir/locations?organization={orgId} — list FHIR Locations (admin only) */
export async function GET(req: Request) {
  const authErr = await requireAdmin(req);
  if (authErr) {
    return NextResponse.json(
      buildOperationOutcome("error", "security", authErr.error),
      { status: authErr.httpStatus, headers: { "content-type": FHIR_CT } },
    );
  }

  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get("organization") ?? undefined;

  const result = await fhirLocationsController.list(organizationId);
  const httpStatus = (result as { httpStatus?: number }).httpStatus ?? 200;
  const { httpStatus: _, ...body } = result as unknown as Record<string, unknown>;
  return NextResponse.json(body, { status: httpStatus, headers: { "content-type": FHIR_CT } });
}
