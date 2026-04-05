/**
 * ResultsController — handles the GET /api/diagnostic-reports endpoint.
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
import type { ListResultsQueryDto } from "../dto/ResultDto";

// ── Minimal FHIR type scoped to this controller ───────────────────────────────
interface FhirDiagnosticReport {
  resourceType: "DiagnosticReport";
  id?: string;
  [key: string]: unknown;
}

export type ResultsBundleResponse =
  | (FhirBundle<FhirDiagnosticReport> & { httpStatus?: number })
  | FhirOperationOutcome;

// ─────────────────────────────────────────────────────────────────────────────

export class ResultsController {
  private readonly log: Logger;

  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
    logger?: Logger,
  ) {
    this.log = logger ?? createLogger("ResultsController");
  }

  async list(query: ListResultsQueryDto): Promise<ResultsBundleResponse> {
    const {
      q = "",
      status = "",
      patientId = "",
      patientName = "",
      orderNumber = "",
      page = 1,
      pageSize = 20,
      orgFhirId,
      orgGln,
    } = query;

    // No org filter = internal lab user (ZLZ/ZetLab Systembetreiber) → sees all results.
    // External Auftraggeber always have orgGln/orgFhirId configured → filtered to their org.

    const safePage     = Math.max(1, page);
    const safePageSize = Math.max(1, pageSize);
    const offset       = (safePage - 1) * safePageSize;

    const applyOrgFilter = (u: URL) => {
      if (patientId) return; // explicit patient filter takes precedence
      if (orgFhirId) {
        u.searchParams.set("subject:Patient.organization", `Organization/${orgFhirId}`);
      } else if (orgGln) {
        u.searchParams.set("subject:Patient.organization:identifier", `${EnvConfig.fhirSystems.gln}|${orgGln}`);
      }
    };

    const url = new URL(`${this.fhirBase}/DiagnosticReport`);
    if (q)           url.searchParams.set("code", q);
    if (status)      url.searchParams.set("status", status);
    if (patientId)   url.searchParams.set("subject", `Patient/${patientId}`);
    else if (patientName) url.searchParams.set("subject:Patient.name", patientName);
    if (orderNumber) url.searchParams.set("based-on:ServiceRequest.identifier", orderNumber);
    applyOrgFilter(url);
    url.searchParams.set("_count", String(safePageSize));
    url.searchParams.set("_offset", String(offset));

    const countUrl = new URL(`${this.fhirBase}/DiagnosticReport`);
    if (q)           countUrl.searchParams.set("code", q);
    if (status)      countUrl.searchParams.set("status", status);
    if (patientId)   countUrl.searchParams.set("subject", `Patient/${patientId}`);
    else if (patientName) countUrl.searchParams.set("subject:Patient.name", patientName);
    if (orderNumber) countUrl.searchParams.set("based-on:ServiceRequest.identifier", orderNumber);
    applyOrgFilter(countUrl);
    countUrl.searchParams.set("_summary", "count");

    this.log.debug("list DiagnosticReports", { patientId, patientName, orderNumber, status, page: safePage, pageSize: safePageSize });

    try {
      const [res, countRes] = await Promise.all([
        this.fetchFn(url.toString(), { headers: { accept: "application/fhir+json" }, cache: "no-store" }),
        this.fetchFn(countUrl.toString(), { headers: { accept: "application/fhir+json" }, cache: "no-store" }),
      ]);

      if (!res.ok) {
        this.log.error("FHIR DiagnosticReport list failed", { status: res.status });
        return buildOperationOutcome("error", "exception", `FHIR error: ${res.status}`, res.status);
      }

      const bundle = (await res.json()) as FhirBundle<FhirDiagnosticReport>;
      let total = bundle.total ?? 0;
      if (countRes.ok) {
        const countBundle = (await countRes.json()) as FhirBundle;
        total = countBundle.total ?? total;
      }

      this.log.info("DiagnosticReports fetched", { count: bundle.entry?.length ?? 0, total });

      return {
        ...bundle,
        type: "searchset" as const,
        total,
        link: buildPaginationLinks("/api/diagnostic-reports", safePage, safePageSize, total),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("DiagnosticReport fetch threw", { message });
      return buildOperationOutcome("error", "exception", message || "Network error", 500);
    }
  }
}

/** Production singleton — routes import this directly. */
export const resultsController = new ResultsController();
