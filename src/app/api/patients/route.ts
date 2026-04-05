import { NextResponse } from "next/server";
import { patientsController } from "@/infrastructure/api/controllers/PatientsController";
import { getSessionUserWithOrg } from "@/lib/auth";
import { buildOperationOutcome } from "@/infrastructure/fhir/FhirTypes";

const FHIR_CONTENT_TYPE = "application/fhir+json";

export async function GET(request: Request) {
  const sessionUser = await getSessionUserWithOrg();
  if (!sessionUser) {
    return NextResponse.json(
      buildOperationOutcome("error", "security", "Not authenticated", 401),
      { status: 401, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || undefined;

  // Admin and internal lab users see all patients — no org filter.
  // External Auftraggeber (role "user" with org profile) are scoped to their org.
  const isInternalUser = sessionUser.role === "admin";

  const result = await patientsController.list({
    ...(q !== undefined && { q }),
    page:         parseInt(searchParams.get("page")     ?? "1",  10),
    pageSize:     parseInt(searchParams.get("pageSize") ?? "10", 10),
    showInactive: searchParams.get("showInactive") === "true",
    showAll:      searchParams.get("showAll")      === "true",
    ...(!isInternalUser && sessionUser.orgFhirId !== undefined && { orgFhirId: sessionUser.orgFhirId }),
    ...(!isInternalUser && sessionUser.orgGln    !== undefined && { orgGln:    sessionUser.orgGln }),
  });

  const httpStatus = (result as { httpStatus?: number }).httpStatus ?? 200;
  const { httpStatus: _, ...body } = result as unknown as Record<string, unknown>;
  return NextResponse.json(body, { status: httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } });
}
