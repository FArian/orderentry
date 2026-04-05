import { NextResponse } from "next/server";
import { resultsController } from "@/infrastructure/api/controllers/ResultsController";
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

  const q           = searchParams.get("q")           || undefined;
  const status      = searchParams.get("status")      || undefined;
  const patientId   = searchParams.get("patientId")   || undefined;
  const patientName = searchParams.get("patientName") || undefined;
  const orderNumber = searchParams.get("orderNumber") || undefined;

  const isInternalUser = sessionUser.role === "admin";

  const result = await resultsController.list({
    ...(q           !== undefined && { q }),
    ...(status      !== undefined && { status }),
    ...(patientId   !== undefined && { patientId }),
    ...(patientName !== undefined && { patientName }),
    ...(orderNumber !== undefined && { orderNumber }),
    page:     parseInt(searchParams.get("page")     ?? "1",  10),
    pageSize: parseInt(searchParams.get("pageSize") ?? "20", 10),
    ...(!isInternalUser && sessionUser.orgFhirId !== undefined && { orgFhirId: sessionUser.orgFhirId }),
    ...(!isInternalUser && sessionUser.orgGln    !== undefined && { orgGln:    sessionUser.orgGln }),
  });

  const httpStatus = (result as { httpStatus?: number }).httpStatus ?? 200;
  const { httpStatus: _, ...body } = result as unknown as Record<string, unknown>;
  return NextResponse.json(body, { status: httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } });
}
