import type {
  IResultRepository,
  PagedResults,
  ResultSearchQuery,
} from "../interfaces/repositories/IResultRepository";

/**
 * Use case: full-text / filtered search for results.
 * Normalises the query before delegating to the repository.
 */
export class SearchResults {
  constructor(private readonly repo: IResultRepository) {}

  async execute(query: ResultSearchQuery): Promise<PagedResults> {
    const q           = (query.q          ?? "").trim() || undefined;
    const patientName = (query.patientName ?? "").trim() || undefined;
    const patientId   = (query.patientId   ?? "").trim() || undefined;
    const orderNumber = (query.orderNumber ?? "").trim() || undefined;

    const normalised: ResultSearchQuery = {
      ...(query.status      !== undefined && { status: query.status }),
      ...(q                 !== undefined && { q }),
      ...(patientName       !== undefined && { patientName }),
      ...(patientId         !== undefined && { patientId }),
      ...(orderNumber       !== undefined && { orderNumber }),
      page:     Math.max(1, query.page     ?? 1),
      pageSize: Math.min(100, Math.max(1, query.pageSize ?? 20)),
    };
    return this.repo.search(normalised);
  }
}
