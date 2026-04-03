/**
 * GET /api/fhir-health
 *
 * Tests the FHIR server connection using whatever auth is currently configured
 * (FHIR_AUTH_TYPE + related ENV vars). Calls GET /metadata (FHIR CapabilityStatement).
 *
 * Response 200: { ok: true,  message: "FHIR server reachable", fhirVersion: "4.0.1" }
 * Response 200: { ok: false, message: "FHIR <status>: /metadata" }
 * Admin auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { fhirGet } from "@/infrastructure/fhir/FhirClient";
import { checkAdminAccess } from "@/lib/auth";

interface CapabilityStatement {
  fhirVersion?: string;
  software?: { name?: string; version?: string };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: auth.httpStatus });
  }

  try {
    const cs = await fhirGet<CapabilityStatement>("/metadata");
    return NextResponse.json({
      ok: true,
      message: "FHIR server reachable",
      fhirVersion: cs.fhirVersion ?? "unknown",
      server: cs.software?.name ?? "HAPI FHIR",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ ok: false, message });
  }
}
