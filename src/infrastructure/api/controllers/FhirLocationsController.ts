/**
 * FhirLocationsController — lists FHIR Location resources.
 *
 * Supports optional filtering by managing organization:
 *   GET /api/fhir/locations?organization=klinik-hirslanden
 *
 * Returns a FHIR searchset Bundle<Location>.
 * Errors return FhirOperationOutcome.
 */

import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import { getAdminFromRequest } from "@/lib/auth";
import { createLogger } from "@/infrastructure/logging/Logger";

const log = createLogger("FhirLocationsController");
import {
  buildOperationOutcome,
  buildSearchBundle,
  type FhirBundle,
  type FhirOperationOutcome,
} from "@/infrastructure/fhir/FhirTypes";

export interface FhirLocation {
  resourceType: "Location";
  id?:          string;
  name?:        string;
  status?:      string;
  address?:     { city?: string; line?: string[] };
  managingOrganization?: { reference?: string };
}

export async function requireAdmin(req: Request): Promise<{ error: string; httpStatus: number } | null> {
  const session = await getAdminFromRequest(req);
  if (!session) return { error: "Unauthorized", httpStatus: 401 };
  return null;
}

export class FhirLocationsController {
  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  async list(organizationId?: string): Promise<FhirBundle<FhirLocation> | FhirOperationOutcome> {
    try {
      const params = new URLSearchParams({ _count: "200", _sort: "name" });
      if (organizationId) params.set("organization", organizationId);

      const url = `${this.fhirBase}/Location?${params.toString()}`;
      const res = await this.fetchFn(url, {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });

      if (!res.ok) {
        return buildOperationOutcome("error", "exception", `FHIR ${res.status}`, 502);
      }

      const bundle = (await res.json()) as FhirBundle<FhirLocation>;
      const locations = (bundle.entry ?? [])
        .map((e) => e.resource)
        .filter((r): r is FhirLocation => !!r && !!r.id);

      return buildSearchBundle(locations, locations.length) as unknown as FhirBundle<FhirLocation>;
    } catch (err: unknown) {
      log.error("list failed", { message: err instanceof Error ? err.message : String(err) });
      return buildOperationOutcome("error", "exception", "Internal error", 500);
    }
  }
}

export const fhirLocationsController = new FhirLocationsController();
