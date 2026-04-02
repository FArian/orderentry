import { NextResponse } from "next/server";
import {
  fhirOrganizationsController,
  requireAdmin,
} from "@/infrastructure/api/controllers/FhirOrganizationsController";
import type { CreateOrganizationRequestDto } from "@/infrastructure/api/dto/FhirRegistryDto";

/** GET /api/fhir/organizations — list all FHIR Organizations (admin only) */
export async function GET() {
  const authErr = await requireAdmin();
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.httpStatus });

  const result = await fhirOrganizationsController.list();
  const { httpStatus, ...body } = result as typeof result & { httpStatus?: number };
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}

/** POST /api/fhir/organizations — create a FHIR Organization (admin only) */
export async function POST(request: Request) {
  const authErr = await requireAdmin();
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.httpStatus });

  let dto: CreateOrganizationRequestDto;
  try {
    dto = (await request.json()) as CreateOrganizationRequestDto;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await fhirOrganizationsController.create(dto);
  const { httpStatus, ...body } = result as typeof result & { httpStatus?: number };
  return NextResponse.json(body, { status: httpStatus ?? 201 });
}
