import type {
  IResultRepository,
  PagedResults,
  ResultSearchQuery,
} from "@/application/interfaces/repositories/IResultRepository";

/**
 * Use case: full-text / filtered search for results.
 * Normalises the query before delegating to the repository.
 */
export class SearchResults {
  constructor(private readonly repo: IResultRepository) {}

  async execute(query: ResultSearchQuery): Promise<PagedResults> {
    const normalised: ResultSearchQuery = {
      ...query,
      q: (query.q ?? "").trim() || undefined,
      patientName: (query.patientName ?? "").trim() || undefined,
      patientId: (query.patientId ?? "").trim() || undefined,
      orderNumber: (query.orderNumber ?? "").trim() || undefined,
      page: Math.max(1, query.page ?? 1),
      pageSize: Math.min(100, Math.max(1, query.pageSize ?? 20)),
    };
    return this.repo.search(normalised);
  }
}
