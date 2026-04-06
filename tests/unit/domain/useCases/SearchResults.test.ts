import { SearchResults } from "@/application/useCases/SearchResults";
import { MockResultRepository } from "../../../mocks/MockResultRepository";
import type { Result } from "@/domain/entities/Result";
import { ResultStatus } from "@/domain/entities/Result";

describe("SearchResults use case", () => {
  const seed: Partial<Result>[] = [
    { id: "1", codeText: "Blutbild",      patientId: "p1", patientDisplay: "Müller Hans",   status: ResultStatus.FINAL       },
    { id: "2", codeText: "Urinstatus",     patientId: "p2", patientDisplay: "Schmid Maria",  status: ResultStatus.PRELIMINARY },
    { id: "3", codeText: "Blutbild klein", patientId: "p1", patientDisplay: "Müller Hans",   status: ResultStatus.PARTIAL     },
    { id: "4", codeText: "Lipidprofil",    patientId: "p3", patientDisplay: "Weber Anna",    status: ResultStatus.FINAL       },
  ];

  function makeUseCase() {
    return new SearchResults(new MockResultRepository(seed));
  }

  it("searches by code text (q param)", async () => {
    const uc = makeUseCase();
    const result = await uc.execute({ q: "Blutbild" });
    expect(result.data).toHaveLength(2);
    expect(result.data.every((r) => r.codeText.toLowerCase().includes("blutbild"))).toBe(true);
  });

  it("searches by patient name", async () => {
    const uc = makeUseCase();
    const result = await uc.execute({ patientName: "Müller" });
    expect(result.data).toHaveLength(2);
    expect(result.data.every((r) => r.patientId === "p1")).toBe(true);
  });

  it("searches by patient ID", async () => {
    const uc = makeUseCase();
    const result = await uc.execute({ patientId: "p3" });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe("4");
  });

  it("normalises empty string fields to undefined", async () => {
    const uc = makeUseCase();
    // Empty strings should not filter — should return all
    const result = await uc.execute({ q: "  ", patientName: "" });
    expect(result.data).toHaveLength(4);
  });

  it("enforces minimum page = 1", async () => {
    const uc = makeUseCase();
    const result = await uc.execute({ page: -5 });
    expect(result.page).toBe(1);
  });

  it("enforces maximum pageSize = 100", async () => {
    const uc = makeUseCase();
    const result = await uc.execute({ pageSize: 9999 });
    expect(result.pageSize).toBe(100);
  });

  it("returns empty when no match", async () => {
    const uc = makeUseCase();
    const result = await uc.execute({ q: "Nichtexistent" });
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
