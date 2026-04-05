import { NextResponse } from "next/server";
import { ordersController } from "@/infrastructure/api/controllers/OrdersController";
import { getSessionUserWithOrg } from "@/lib/auth";
import { buildOperationOutcome } from "@/infrastructure/fhir/FhirTypes";

const FHIR_CONTENT_TYPE = "application/fhir+json";

export async function GET() {
  const sessionUser = await getSessionUserWithOrg();
  if (!sessionUser) {
    return NextResponse.json(
      buildOperationOutcome("error", "security", "Not authenticated", 401),
      { status: 401, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }

  const isInternalUser = sessionUser.role === "admin";

  const result = await ordersController.list({
    ...(!isInternalUser && sessionUser.orgFhirId !== undefined && { orgFhirId: sessionUser.orgFhirId }),
    ...(!isInternalUser && sessionUser.orgGln    !== undefined && { orgGln:    sessionUser.orgGln }),
  });

  const httpStatus = (result as { httpStatus?: number }).httpStatus ?? 200;
  const { httpStatus: _, ...body } = result as unknown as Record<string, unknown>;
  return NextResponse.json(body, { status: httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } });
}
