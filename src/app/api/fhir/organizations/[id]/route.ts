import { NextResponse } from "next/server";
import {
  fhirOrganizationsController,
  requireAdmin,
} from "@/infrastructure/api/controllers/FhirOrganizationsController";
import { buildOperationOutcome } from "@/infrastructure/fhir/FhirTypes";

const FHIR_CONTENT_TYPE = "application/fhir+json";

/** PUT /api/fhir/organizations/[id] — update a FHIR Organization (admin only) */
export async function PUT(
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
  const dto = (await req.json().catch(() => ({}))) as { name?: string; gln?: string; parentId?: string };
  const result = await fhirOrganizationsController.update(id, {
    name: dto.name ?? "",
    gln:  dto.gln  ?? "",
    ...(dto.parentId ? { parentId: dto.parentId } : {}),
  });
  const httpStatus = (result as { httpStatus?: number }).httpStatus ?? 200;
  const { httpStatus: _, ...body } = result as unknown as Record<string, unknown>;
  return NextResponse.json(body, { status: httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } });
}

/** DELETE /api/fhir/organizations/[id] — delete a FHIR Organization (admin only) */
export async function DELETE(
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
  const result = await fhirOrganizationsController.delete(id);
  const httpStatus = result.httpStatus ?? 200;
  const { httpStatus: _, ...body } = result as unknown as Record<string, unknown>;
  return NextResponse.json(body, { status: httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } });
}
