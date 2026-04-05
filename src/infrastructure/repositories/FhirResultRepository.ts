import type {
  IResultRepository,
  PagedResults,
  ResultSearchQuery,
} from "@/application/interfaces/repositories/IResultRepository";
import type { Result } from "@/domain/entities/Result";
import { HttpClient } from "@/infrastructure/api/HttpClient";
import {
  type FhirBundle,
  extractPaginationFromBundle,
} from "@/infrastructure/fhir/FhirTypes";
import {
  DiagnosticReportMapper,
  type FhirDiagnosticReport,
} from "@/infrastructure/fhir/DiagnosticReportMapper";
import { createClientLogger } from "@/shared/utils/clientLogger";

const log = createClientLogger("FhirResultRepository");

/**
 * Repository implementation that delegates to the Next.js API route
 * /api/diagnostic-reports, which returns a FHIR searchset Bundle
 * of DiagnosticReport resources.
 *
 * Used client-side only (depends on window.location via HttpClient).
 */
export class FhirResultRepository implements IResultRepository {
  private readonly http = new HttpClient();

  async search(query: ResultSearchQuery): Promise<PagedResults> {
    const params: Record<string, string | undefined> = {
      q:           query.q,
      status:      query.status,
      patientId:   query.patientId,
      patientName: query.patientName,
      orderNumber: query.orderNumber,
      page:        query.page     !== undefined ? String(query.page)     : undefined,
      pageSize:    query.pageSize !== undefined ? String(query.pageSize) : undefined,
    };

    const bundle = await this.http.get<FhirBundle<FhirDiagnosticReport>>(
      "/api/diagnostic-reports",
      params,
    );

    const data: Result[] = (bundle.entry ?? [])
      .map((e) => e.resource)
      .filter((r): r is FhirDiagnosticReport =>
        !!r && (r as { resourceType?: string }).resourceType === "DiagnosticReport" && !!(r as { id?: string }).id,
      )
      .map((r) => DiagnosticReportMapper.toDomain(r));

    const { page, pageSize } = extractPaginationFromBundle(bundle, {
      page:     query.page     ?? 1,
      pageSize: query.pageSize ?? 20,
    });

    return { data, total: bundle.total ?? data.length, page, pageSize };
  }

  async getById(id: string): Promise<Result | null> {
    try {
      const bundle = await this.http.get<FhirBundle<FhirDiagnosticReport>>(
        `/api/diagnostic-reports/${encodeURIComponent(id)}`,
      );
      const first = bundle.entry?.[0]?.resource;
      return first ? DiagnosticReportMapper.toDomain(first) : null;
    } catch (err: unknown) {
      log.error("getById failed", { id, message: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }
}
