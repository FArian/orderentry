/**
 * ResultsController — handles the GET /api/diagnostic-reports endpoint.
 *
 * Separates FHIR query logic from the Next.js route handler so that:
 *  - The route stays thin (param parsing → controller → NextResponse).
 *  - The controller is independently testable via constructor injection.
 */

import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import { createLogger, type Logger } from "@/infrastructure/logging/Logger";
import type {
  ListResultsQueryDto,
  PagedResultsResponseDto,
  ResultResponseDto,
} from "../dto/ResultDto";

// ── Minimal FHIR types scoped to this controller ─────────────────────────────
interface FhirCoding { system?: string; code?: string; display?: string }
interface FhirCodeableConcept { text?: string; coding?: FhirCoding[] }
interface FhirAttachment { contentType?: string; data?: string; title?: string }
interface FhirDiagnosticReport {
  resourceType: "DiagnosticReport";
  id?: string;
  status?: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: { reference?: string; display?: string };
  effectiveDateTime?: string;
  issued?: string;
  basedOn?: Array<{ reference?: string }>;
  result?: Array<{ reference?: string; display?: string }>;
  conclusion?: string;
  presentedForm?: FhirAttachment[];
  meta?: { lastUpdated?: string };
}
interface FhirBundle<T = unknown> {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource?: T }>;
}
// ─────────────────────────────────────────────────────────────────────────────

function extractPatientId(subject?: { reference?: string }): string {
  const ref = subject?.reference ?? "";
  return ref.startsWith("Patient/") ? ref.slice("Patient/".length) : ref;
}

function mapReport(dr: FhirDiagnosticReport): ResultResponseDto {
  const forms = dr.presentedForm ?? [];
  const pdf = forms.find((f) => (f.contentType ?? "").toLowerCase().includes("pdf"));
  const hl7 = forms.find((f) => (f.contentType ?? "").toLowerCase().includes("hl7"));
  return {
    id: dr.id as string,
    status: dr.status ?? "",
    codeText: dr.code?.text ?? dr.code?.coding?.[0]?.display ?? "",
    category:
      dr.category?.[0]?.text ?? dr.category?.[0]?.coding?.[0]?.display ?? "",
    effectiveDate: dr.effectiveDateTime ?? dr.issued ?? dr.meta?.lastUpdated ?? "",
    resultCount: Array.isArray(dr.result) ? dr.result.length : 0,
    conclusion: dr.conclusion ?? "",
    basedOn: (dr.basedOn ?? []).map((r) => r.reference ?? "").filter(Boolean),
    patientId: extractPatientId(dr.subject),
    patientDisplay: dr.subject?.display ?? "",
    pdfData: pdf?.data ?? null,
    pdfTitle: pdf?.title ?? null,
    hl7Data: hl7?.data ?? null,
    hl7Title: hl7?.title ?? null,
  };
}

export class ResultsController {
  private readonly log: Logger;

  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
    logger?: Logger,
  ) {
    this.log = logger ?? createLogger("ResultsController");
  }

  async list(query: ListResultsQueryDto): Promise<PagedResultsResponseDto> {
    const {
      q = "",
      status = "",
      patientId = "",
      patientName = "",
      orderNumber = "",
      page = 1,
      pageSize = 20,
    } = query;

    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, pageSize);
    const offset = (safePage - 1) * safePageSize;

    // ── Data query ────────────────────────────────────────────────────────────
    const url = new URL(`${this.fhirBase}/DiagnosticReport`);
    if (q) url.searchParams.set("code", q);
    if (status) url.searchParams.set("status", status);
    if (patientId) url.searchParams.set("subject", `Patient/${patientId}`);
    else if (patientName) url.searchParams.set("subject:Patient.name", patientName);
    if (orderNumber)
      url.searchParams.set("based-on:ServiceRequest.identifier", orderNumber);
    url.searchParams.set("_sort", "-_lastUpdated");
    url.searchParams.set("_count", String(safePageSize));
    url.searchParams.set("_getpagesoffset", String(offset));

    // ── Count query ───────────────────────────────────────────────────────────
    const countUrl = new URL(`${this.fhirBase}/DiagnosticReport`);
    if (q) countUrl.searchParams.set("code", q);
    if (status) countUrl.searchParams.set("status", status);
    if (patientId) countUrl.searchParams.set("subject", `Patient/${patientId}`);
    else if (patientName) countUrl.searchParams.set("subject:Patient.name", patientName);
    if (orderNumber)
      countUrl.searchParams.set("based-on:ServiceRequest.identifier", orderNumber);
    countUrl.searchParams.set("_summary", "count");
    countUrl.searchParams.set("_total", "accurate");

    this.log.debug("list DiagnosticReports", { patientId, patientName, orderNumber, status, page: safePage, pageSize: safePageSize });

    try {
      const [res, countRes] = await Promise.all([
        this.fetchFn(url.toString(), {
          headers: { accept: "application/fhir+json" },
          cache: "no-store",
        }),
        this.fetchFn(countUrl.toString(), {
          headers: { accept: "application/fhir+json" },
          cache: "no-store",
        }),
      ]);

      if (!res.ok) {
        this.log.error("FHIR DiagnosticReport list failed", { status: res.status });
        return {
          data: [],
          total: 0,
          page: safePage,
          pageSize: safePageSize,
          error: `FHIR error: ${res.status}`,
          httpStatus: res.status,
        };
      }

      const bundle = (await res.json()) as FhirBundle<FhirDiagnosticReport>;
      let total = bundle.total ?? 0;
      if (countRes.ok) {
        const countBundle = (await countRes.json()) as FhirBundle;
        total = countBundle.total ?? total;
      }

      const data = (bundle.entry ?? [])
        .map((e) => e.resource)
        .filter(
          (r): r is FhirDiagnosticReport =>
            !!r && r.resourceType === "DiagnosticReport" && !!r.id,
        )
        .map(mapReport);

      this.log.info("DiagnosticReports fetched", { count: data.length, total });
      return { data, total, page: safePage, pageSize: safePageSize };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("DiagnosticReport fetch threw", { message });
      return {
        data: [],
        total: 0,
        page: safePage,
        pageSize: safePageSize,
        error: message || "Network error",
        httpStatus: 500,
      };
    }
  }
}

/** Production singleton — routes import this directly. */
export const resultsController = new ResultsController();
