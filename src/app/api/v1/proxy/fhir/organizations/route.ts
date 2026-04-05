import { NextRequest, NextResponse } from "next/server";
import { apiGateway }               from "@/infrastructure/api/gateway/ApiGateway";
import { fhirGet }                  from "@/infrastructure/fhir/FhirClient";

export const dynamic = "force-dynamic";

interface FhirOrganization {
  resourceType: string;
  id:           string;
  name?:        string;
  identifier?:  Array<{ system?: string; value?: string }>;
}

interface FhirBundle {
  entry?: Array<{ resource?: FhirOrganization }>;
}

const GLN_SYSTEMS = ["gln", "GLN", "gs1", "2.51.1.3", "refdata"];
const GLN_PATTERN = /^760\d{10}$/;

function extractGln(org: FhirOrganization): string {
  // 1. Match by known GLN system URIs
  const bySystem = org.identifier?.find(
    (i) => GLN_SYSTEMS.some((s) => i.system?.includes(s)),
  )?.value;
  if (bySystem) return bySystem;

  // 2. Fallback: any identifier whose value looks like a Swiss GLN (760 + 10 digits)
  return org.identifier?.find((i) => GLN_PATTERN.test(i.value ?? ""))?.value ?? "";
}

function toResult(org: FhirOrganization) {
  return {
    orgFhirId: org.id,
    orgGln:    extractGln(org),
    orgName:   org.name ?? org.id,
  };
}

/**
 * GET /api/v1/proxy/fhir/organizations?q=<GLN_or_name>
 *
 * Searches FHIR Organization resources by GLN identifier or name.
 * Returns { results: [{ orgFhirId, orgGln, orgName }] } for the OrgRule form.
 */
export async function GET(req: NextRequest) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/proxy/fhir/organizations", auth: "admin" },
    async () => {
      const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
      if (q.length < 2) {
        return NextResponse.json({ results: [] });
      }

      // For GLN-like input (10–13 digits), also try with the gs1 system prefix so HAPI
      // can do an exact token match. Without the prefix, HAPI searches identifier.value
      // only and may not return results for numeric-only queries.
      const isGlnLike = /^\d{10,13}$/.test(q);
      const identifierQuery = isGlnLike ? `https://www.gs1.org/gln|${q}` : q;

      // Parallel: search by name AND by identifier (GLN / any identifier)
      const [byName, byGln] = await Promise.allSettled([
        fhirGet<FhirBundle>("/Organization", { name: q, _count: "20" }),
        fhirGet<FhirBundle>("/Organization", { identifier: identifierQuery, _count: "10" }),
      ]);

      const seen = new Set<string>();
      const results: ReturnType<typeof toResult>[] = [];

      for (const settled of [byName, byGln]) {
        if (settled.status !== "fulfilled") continue;
        for (const entry of settled.value?.entry ?? []) {
          const org = entry.resource;
          if (!org || org.resourceType !== "Organization") continue;
          if (seen.has(org.id)) continue;
          seen.add(org.id);
          results.push(toResult(org));
        }
      }

      return NextResponse.json({ results });
    },
  );
}
