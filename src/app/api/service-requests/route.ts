import { NextResponse } from "next/server";
import { ordersController } from "@/infrastructure/api/controllers/OrdersController";
import { getSessionUserWithOrg } from "@/lib/auth";
import { buildOperationOutcome } from "@/infrastructure/fhir/FhirTypes";
import { resolveAccessFilter } from "@/infrastructure/api/middleware/AccessGuard";

const FHIR_CONTENT_TYPE = "application/fhir+json";

export async function GET() {
  const sessionUser = await getSessionUserWithOrg();
  if (!sessionUser) {
    return NextResponse.json(
      buildOperationOutcome("error", "security", "Not authenticated", 401),
      { status: 401, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }

  const access = resolveAccessFilter(sessionUser);
  if (access.type === "deny") {
    return NextResponse.json(
      buildOperationOutcome("error", "forbidden", access.message, access.httpStatus),
      { status: access.httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } },
    );
  }

  const result = await ordersController.list({
    ...(access.type === "org" && { orgFhirId: access.orgFhirIds[0] }),
    ...(access.type === "own" && { requesterFhirId: access.practitionerFhirId }),
  });

  const httpStatus = (result as { httpStatus?: number }).httpStatus ?? 200;
  const { httpStatus: _, ...body } = result as unknown as Record<string, unknown>;
  return NextResponse.json(body, { status: httpStatus, headers: { "content-type": FHIR_CONTENT_TYPE } });
}
