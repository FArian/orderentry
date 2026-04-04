/**
 * GET /api/v1/proxy/fhir/document-references/[id]
 *
 * FHIR proxy — fetches a single DocumentReference from HAPI FHIR.
 * Used by the Local Agent to retrieve the PDF attachment for printing.
 *
 * Auth: Bearer JWT or PAT (same as other FHIR proxy routes)
 */

import { NextResponse, type NextRequest } from "next/server";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { bearerAuthGuard } from "@/infrastructure/auth/BearerAuthGuard";
import { getSessionFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FHIR_CT = "application/fhir+json";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSessionFromCookies();
  const bearer  = await bearerAuthGuard.resolve(req.headers.get("authorization"));

  if (!session && !bearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = `${EnvConfig.fhirBaseUrl}/DocumentReference/${encodeURIComponent(id)}`;

  const upstream = await fetch(url, {
    headers: { Accept: FHIR_CT },
    cache:   "no-store",
  });

  const body = await upstream.text();

  return new NextResponse(body, {
    status:  upstream.status,
    headers: { "content-type": FHIR_CT },
  });
}
