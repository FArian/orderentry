/**
 * PatientsController — handles GET /api/patients.
 *
 * Returns a FHIR searchset Bundle (pass-through from HAPI) with added
 * pagination links.  Error responses are FHIR OperationOutcome.
 */

import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { createLogger, type Logger } from "@/infrastructure/logging/Logger";
import {
  buildOperationOutcome,
  buildPaginationLinks,
  type FhirBundle,
  type FhirOperationOutcome,
} from "@/infrastructure/fhir/FhirTypes";
import type { ListPatientsQueryDto } from "../dto/PatientDto";

// ── Minimal FHIR type scoped to this controller ───────────────────────────────
interface FhirPatientResource {
  resourceType: "Patient";
  id?: string;
  [key: string]: unknown;
}

export type PatientsBundleResponse =
  | (FhirBundle<FhirPatientResource> & { httpStatus?: number })
  | FhirOperationOutcome;

// ─────────────────────────────────────────────────────────────────────────────

export class PatientsController {
  private readonly log: Logger;

  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
    logger?: Logger,
  ) {
    this.log = logger ?? createLogger("PatientsController");
  }

  async list(query: ListPatientsQueryDto): Promise<PatientsBundleResponse> {
    const {
      q = "",
      page = 1,
      pageSize = 10,
      showInactive = false,
      showAll = false,
      orgFhirId,
      orgGln,
    } = query;

    // No org filter = internal lab user (ZLZ/ZetLab Systembetreiber) → sees all patients.
    // External Auftraggeber always have orgGln/orgFhirId configured → filtered to their org.

    const safePage     = Math.max(1, page);
    const safePageSize = Math.max(1, pageSize);
    const offset       = (safePage - 1) * safePageSize;

    const applyOrgFilter = (u: URL) => {
      if (orgFhirId) {
        u.searchParams.set("organization", `Organization/${orgFhirId}`);
      } else if (orgGln) {
        u.searchParams.set("organization:identifier", `${EnvConfig.fhirSystems.gln}|${orgGln}`);
      }
    };

    const applyActiveFilter = (u: URL) => {
      if (showAll) return; // no filter → HAPI returns all patients regardless of active status
      u.searchParams.set("active", showInactive ? "false" : "true");
    };

    const url = new URL(`${this.fhirBase}/Patient`);
    if (q) url.searchParams.set("name", q);
    applyActiveFilter(url);
    url.searchParams.set("_count", String(safePageSize));
    url.searchParams.set("_offset", String(offset));
    applyOrgFilter(url);

    const countUrl = new URL(`${this.fhirBase}/Patient`);
    if (q) countUrl.searchParams.set("name", q);
    applyActiveFilter(countUrl);
    countUrl.searchParams.set("_summary", "count");
    applyOrgFilter(countUrl);

    this.log.debug("list Patients", { q, showInactive, showAll, page: safePage, pageSize: safePageSize });

    try {
      const [res, countRes] = await Promise.all([
        this.fetchFn(url.toString(), { headers: { accept: "application/fhir+json" }, cache: "no-store" }),
        this.fetchFn(countUrl.toString(), { headers: { accept: "application/fhir+json" }, cache: "no-store" }),
      ]);

      if (!res.ok) {
        this.log.error("FHIR Patient list failed", { status: res.status });
        return buildOperationOutcome("error", "exception", `FHIR error: ${res.status}`, res.status);
      }

      const bundle = (await res.json()) as FhirBundle<FhirPatientResource>;
      let total = bundle.total ?? 0;
      if (countRes.ok) {
        const countBundle = (await countRes.json()) as FhirBundle;
        total = countBundle.total ?? total;
      }

      this.log.info("Patients fetched", { count: bundle.entry?.length ?? 0, total });

      return {
        ...bundle,
        type: "searchset" as const,
        total,
        link: buildPaginationLinks("/api/patients", safePage, safePageSize, total),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("Patient list threw", { message });
      return buildOperationOutcome("error", "exception", message || "Network error", 500);
    }
  }
}

/** Production singleton — routes import this directly. */
export const patientsController = new PatientsController();
