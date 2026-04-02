import type {
  IResultRepository,
  PagedResults,
  ResultSearchQuery,
} from "@/application/interfaces/repositories/IResultRepository";
import type { Result } from "@/domain/entities/Result";
import { ResultFactory } from "@/domain/factories/ResultFactory";

/**
 * In-memory mock for IResultRepository.
 * Use this in unit tests to avoid real FHIR API calls.
 *
 * @example
 * const repo = new MockResultRepository([
 *   ResultFactory.create({ id: "1", status: "final", patientId: "p1" }),
 * ]);
 * const service = new ResultService(repo);
 */
export class MockResultRepository implements IResultRepository {
  private data: Result[];

  constructor(seed: Partial<Result>[] = []) {
    this.data = seed.map((d) => ResultFactory.create(d));
  }

  async search(query: ResultSearchQuery): Promise<PagedResults> {
    let filtered = [...this.data];

    if (query.status) {
      filtered = filtered.filter((r) => r.status === query.status);
    }
    if (query.patientId) {
      filtered = filtered.filter((r) => r.patientId === query.patientId);
    }
    if (query.patientName) {
      const lc = query.patientName.toLowerCase();
      filtered = filtered.filter((r) =>
        r.patientDisplay.toLowerCase().includes(lc),
      );
    }
    if (query.q) {
      const lc = query.q.toLowerCase();
      filtered = filtered.filter((r) =>
        r.codeText.toLowerCase().includes(lc),
      );
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start = (page - 1) * pageSize;

    return {
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  async getById(id: string): Promise<Result | null> {
    return this.data.find((r) => r.id === id) ?? null;
  }

  /** Helper: add items to the in-memory store between test assertions. */
  seed(items: Partial<Result>[]): void {
    this.data.push(...items.map((d) => ResultFactory.create(d)));
  }

  /** Helper: replace all items. */
  reset(items: Partial<Result>[] = []): void {
    this.data = items.map((d) => ResultFactory.create(d));
  }
}
