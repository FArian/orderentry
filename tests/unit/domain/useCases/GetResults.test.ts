import { GetResults } from "@/application/useCases/GetResults";
import { MockResultRepository } from "../../../mocks/MockResultRepository";
import { ResultStatus } from "@/domain/entities/Result";

describe("GetResults use case", () => {
  function makeRepo(count = 5) {
    return new MockResultRepository(
      Array.from({ length: count }, (_, i) => ({
        id: `dr-${i + 1}`,
        status: i % 2 === 0 ? ResultStatus.FINAL : ResultStatus.PRELIMINARY,
        codeText: `Test ${i + 1}`,
        patientId: `patient-${(i % 3) + 1}`,
        patientDisplay: `Patient ${(i % 3) + 1}`,
      })),
    );
  }

  it("returns all results when no filters applied", async () => {
    const repo = makeRepo(5);
    const useCase = new GetResults(repo);

    const result = await useCase.execute();

    expect(result.data).toHaveLength(5);
    expect(result.total).toBe(5);
  });

  it("filters by status", async () => {
    const repo = makeRepo(5);
    const useCase = new GetResults(repo);

    const result = await useCase.execute({ status: ResultStatus.FINAL });

    // Items 0, 2, 4 are 'final'
    expect(result.data.every((r) => r.status === ResultStatus.FINAL)).toBe(true);
    expect(result.total).toBe(3);
  });

  it("filters by patientId", async () => {
    const repo = makeRepo(6);
    const useCase = new GetResults(repo);

    const result = await useCase.execute({ patientId: "patient-1" });

    expect(result.data.every((r) => r.patientId === "patient-1")).toBe(true);
  });

  it("paginates correctly", async () => {
    const repo = makeRepo(10);
    const useCase = new GetResults(repo);

    const page1 = await useCase.execute({ page: 1, pageSize: 4 });
    const page2 = await useCase.execute({ page: 2, pageSize: 4 });
    const page3 = await useCase.execute({ page: 3, pageSize: 4 });

    expect(page1.data).toHaveLength(4);
    expect(page2.data).toHaveLength(4);
    expect(page3.data).toHaveLength(2); // remainder
    expect(page1.total).toBe(10);
  });

  it("returns empty data for empty repository", async () => {
    const repo = new MockResultRepository();
    const useCase = new GetResults(repo);

    const result = await useCase.execute();

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("defaults page and pageSize when not provided", async () => {
    const repo = makeRepo(3);
    const useCase = new GetResults(repo);

    const result = await useCase.execute({});

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });
});
