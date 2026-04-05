import { NextResponse } from "next/server";
import {
  fhirOrganizationsController,
  requireAdmin,
} from "@/infrastructure/api/controllers/FhirOrganizationsController";
import { buildOperationOutcome } from "@/infrastructure/fhir/FhirTypes";

const FHIR_CONTENT_TYPE = "application/fhir+json";

/** GET /api/fhir/organizations/[id]/references — list resources referencing this org (admin only) */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = await requireAdmin(req);
  if (authErr) {
    return NextResponse.json(
      buildOperationOutcome("error", "security", authErr.error),
      { status: authErr.httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }

  const { id } = await params;
  const refs = await fhirOrganizationsController.references(id);
  return NextResponse.json({ references: refs });
}
