import type {
  IResultRepository,
  PagedResults,
  ResultSearchQuery,
} from "../interfaces/repositories/IResultRepository";

/**
 * Use case: retrieve a paginated list of results (DiagnosticReports).
 * May be filtered by status, patient, order number, or code text.
 */
export class GetResults {
  constructor(private readonly repo: IResultRepository) {}

  async execute(query: ResultSearchQuery = {}): Promise<PagedResults> {
    return this.repo.search(query);
  }
}
