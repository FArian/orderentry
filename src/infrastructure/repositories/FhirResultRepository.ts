import type {
  IResultRepository,
  PagedResults,
  ResultSearchQuery,
} from "@/application/interfaces/repositories/IResultRepository";
import type { Result } from "@/domain/entities/Result";
import { HttpClient } from "@/infrastructure/api/HttpClient";

/** Shape returned by /api/diagnostic-reports */
interface ApiResultsResponse {
  data: Result[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

/**
 * Repository implementation that delegates to the Next.js API route
 * /api/diagnostic-reports, which proxies to the FHIR server.
 *
 * Used client-side only (depends on window.location via HttpClient).
 */
export class FhirResultRepository implements IResultRepository {
  private readonly http = new HttpClient();

  async search(query: ResultSearchQuery): Promise<PagedResults> {
    const params: Record<string, string | undefined> = {
      q: query.q,
      status: query.status,
      patientId: query.patientId,
      patientName: query.patientName,
      orderNumber: query.orderNumber,
      page: query.page !== undefined ? String(query.page) : undefined,
      pageSize: query.pageSize !== undefined ? String(query.pageSize) : undefined,
    };

    const res = await this.http.get<ApiResultsResponse>(
      "/api/diagnostic-reports",
      params,
    );
    if (res.error) throw new Error(res.error);
    return { data: res.data, total: res.total, page: res.page, pageSize: res.pageSize };
  }

  async getById(id: string): Promise<Result | null> {
    try {
      const res = await this.http.get<ApiResultsResponse>(
        `/api/diagnostic-reports/${encodeURIComponent(id)}`,
      );
      return res.data?.[0] ?? null;
    } catch {
      return null;
    }
  }
}
