import { GetResults } from "../useCases/GetResults";
import { SearchResults } from "../useCases/SearchResults";
import type { IResultRepository } from "../interfaces/repositories/IResultRepository";
import type {
  PagedResults,
  ResultSearchQuery,
} from "../interfaces/repositories/IResultRepository";

/**
 * Application service that orchestrates result-related use cases.
 * Instantiate once and reuse (e.g. as a module-level singleton in hooks).
 */
export class ResultService {
  private readonly getResults: GetResults;
  private readonly searchResults: SearchResults;

  constructor(repo: IResultRepository) {
    this.getResults = new GetResults(repo);
    this.searchResults = new SearchResults(repo);
  }

  /** Paginated list with optional filters. */
  list(query: ResultSearchQuery = {}): Promise<PagedResults> {
    return this.getResults.execute(query);
  }

  /** Filtered search — normalises inputs before querying. */
  search(query: ResultSearchQuery): Promise<PagedResults> {
    return this.searchResults.execute(query);
  }
}
