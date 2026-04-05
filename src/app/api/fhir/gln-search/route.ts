import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { fhirGet } from "@/infrastructure/fhir/FhirClient";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { createLogger } from "@/infrastructure/logging/Logger";

const log = createLogger("fhir-gln-search");

/**
 * GET /api/fhir/gln-search?gln={13-digit-gln}[&resourceType=Organization]
 *
 * Searches the FHIR server for a Practitioner or Organization by GLN.
 * Standard FHIR R4 identifier search:
 *   Practitioner?identifier={FHIR_SYSTEM_GLN}|{gln}&_count=1
 *   Organization?identifier={FHIR_SYSTEM_GLN}|{gln}&_count=1
 *
 * If resourceType=Organization is passed, only Organizations are searched.
 * Otherwise Practitioner is tried first, then Organization.
 *
 * Requires session auth (not admin-only).
 */

interface FhirName {
  use?: string;
  family?: string;
  given?: string[];
}

interface FhirResource {
  resourceType: string;
  id?: string;
  name?: string | FhirName[];
}

interface FhirBundle {
  total?: number;
  entry?: { resource?: FhirResource }[];
}

export interface GlnSearchResult {
  found: boolean;
  ptype?: "NAT" | "JUR";
  fhirId?: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  error?: string;
}

async function searchFhir(resourceType: "Practitioner" | "Organization", gln: string): Promise<FhirResource | null> {
  const identifier = `${EnvConfig.fhirSystems.gln}|${gln}`;
  try {
    const bundle = await fhirGet<FhirBundle>(`/${resourceType}`, {
      identifier,
      _count: "1",
    });
    return bundle.entry?.[0]?.resource ?? null;
  } catch (err: unknown) {
    log.warn("FHIR GLN search failed", { gln, resourceType, message: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ found: false, error: "Unauthorized" } satisfies GlnSearchResult, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const gln          = searchParams.get("gln")?.replace(/\D/g, "") ?? "";
  const resourceType = searchParams.get("resourceType");

  if (gln.length !== 13) {
    return NextResponse.json({ found: false, error: "invalidGln" } satisfies GlnSearchResult, { status: 400 });
  }

  // Organization-only search (for org GLN lookup)
  if (resourceType === "Organization") {
    const org = await searchFhir("Organization", gln);
    if (!org) {
      return NextResponse.json({ found: false, error: "glnNotFound" } satisfies GlnSearchResult);
    }
    const result: GlnSearchResult = { found: true, ptype: "JUR" };
    if (org.id) result.fhirId = org.id;
    if (typeof org.name === "string") result.organization = org.name;
    return NextResponse.json(result);
  }

  // Default: search Practitioner first, then Organization
  const practitioner = await searchFhir("Practitioner", gln);
  if (practitioner) {
    const names = Array.isArray(practitioner.name) ? practitioner.name : [];
    const official = names.find((n) => n.use === "official") ?? names[0];
    const result: GlnSearchResult = { found: true, ptype: "NAT" };
    if (practitioner.id) result.fhirId = practitioner.id;
    if (official?.given?.[0]) result.firstName = official.given[0];
    if (official?.family) result.lastName = official.family;
    return NextResponse.json(result);
  }

  const org = await searchFhir("Organization", gln);
  if (org) {
    const result: GlnSearchResult = { found: true, ptype: "JUR" };
    if (org.id) result.fhirId = org.id;
    if (typeof org.name === "string") result.organization = org.name;
    return NextResponse.json(result);
  }

  return NextResponse.json({ found: false, error: "glnNotFound" } satisfies GlnSearchResult);
}
