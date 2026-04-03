import { NextResponse } from "next/server";
import {
  fhirOrganizationsController,
  requireAdmin,
} from "@/infrastructure/api/controllers/FhirOrganizationsController";
import { buildOperationOutcome } from "@/infrastructure/fhir/FhirTypes";

const FHIR_CONTENT_TYPE = "application/fhir+json";

/** GET /api/fhir/organizations — list all FHIR Organizations (admin only) */
export async function GET(req: Request) {
  const authErr = await requireAdmin(req);
  if (authErr) {
    return NextResponse.json(
      buildOperationOutcome("error", "security", authErr.error),
      { status: authErr.httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }

  const result = await fhirOrganizationsController.list();
  const httpStatus = (result as { httpStatus?: number }).httpStatus ?? 200;
  const { httpStatus: _, ...body } = result as unknown as Record<string, unknown>;
  return NextResponse.json(body, { status: httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } });
}

/** POST /api/fhir/organizations — create a FHIR Organization (admin only) */
export async function POST(req: Request) {
  const authErr = await requireAdmin(req);
  if (authErr) {
    return NextResponse.json(
      buildOperationOutcome("error", "security", authErr.error),
      { status: authErr.httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }

  let dto: { name?: string; gln?: string; parentId?: string };
  try {
    dto = (await req.json()) as { name?: string; gln?: string; parentId?: string };
  } catch {
    return NextResponse.json(
      buildOperationOutcome("error", "invalid", "Invalid JSON"),
      { status: 400, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }

  const result = await fhirOrganizationsController.create({
    name: dto.name ?? "",
    gln:  dto.gln  ?? "",
    ...(dto.parentId ? { parentId: dto.parentId } : {}),
  });
  const httpStatus = (result as { httpStatus?: number }).httpStatus ?? 201;
  const { httpStatus: _, ...body } = result as unknown as Record<string, unknown>;
  return NextResponse.json(body, { status: httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } });
}
