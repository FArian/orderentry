import { NextResponse } from "next/server";
import { fhirPractitionersController } from "@/infrastructure/api/controllers/FhirPractitionersController";
import { requireAdmin } from "@/infrastructure/api/controllers/FhirOrganizationsController";
import type { CreatePractitionerRequestDto } from "@/infrastructure/api/dto/FhirRegistryDto";

/** GET /api/fhir/practitioners — list all FHIR Practitioners (admin only) */
export async function GET() {
  const authErr = await requireAdmin();
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.httpStatus });

  const result = await fhirPractitionersController.list();
  const { httpStatus, ...body } = result as typeof result & { httpStatus?: number };
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}

/** POST /api/fhir/practitioners — create a FHIR Practitioner + PractitionerRole (admin only) */
export async function POST(request: Request) {
  const authErr = await requireAdmin();
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.httpStatus });

  let dto: CreatePractitionerRequestDto;
  try {
    dto = (await request.json()) as CreatePractitionerRequestDto;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await fhirPractitionersController.create(dto);
  const { httpStatus, ...body } = result as typeof result & { httpStatus?: number };
  return NextResponse.json(body, { status: httpStatus ?? 201 });
}
