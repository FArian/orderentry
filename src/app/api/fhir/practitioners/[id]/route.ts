import { NextResponse } from "next/server";
import { fhirPractitionersController } from "@/infrastructure/api/controllers/FhirPractitionersController";
import { requireAdmin } from "@/infrastructure/api/controllers/FhirOrganizationsController";
import { buildOperationOutcome } from "@/infrastructure/fhir/FhirTypes";
import type { UpdatePractitionerRequestDto } from "@/infrastructure/api/dto/FhirRegistryDto";

const FHIR_CONTENT_TYPE = "application/fhir+json";

/** PUT /api/fhir/practitioners/[id] — update role + org of a PractitionerRole (admin only) */
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
  let dto: UpdatePractitionerRequestDto;
  try {
    dto = (await req.json()) as UpdatePractitionerRequestDto;
  } catch {
    return NextResponse.json(
      buildOperationOutcome("error", "invalid", "Invalid JSON"),
      { status: 400, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }

  const result = await fhirPractitionersController.update(id, dto);
  const httpStatus = (result as { httpStatus?: number }).httpStatus ?? 200;
  const { httpStatus: _, ...body } = result as unknown as Record<string, unknown>;
  return NextResponse.json(body, { status: httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } });
}
