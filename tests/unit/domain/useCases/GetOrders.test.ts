import { GetOrders } from "@/domain/useCases/GetOrders";
import { CreateOrder } from "@/domain/useCases/CreateOrder";
import { MockOrderRepository } from "../../../mocks/MockOrderRepository";

describe("GetOrders use case", () => {
  const seed = [
    { id: "sr-1", status: "draft",     patientId: "p1", orderNumber: "ZLZ-2024-001" },
    { id: "sr-2", status: "active",    patientId: "p2", orderNumber: "ZLZ-2024-002" },
    { id: "sr-3", status: "completed", patientId: "p1", orderNumber: "ZLZ-2024-003" },
    { id: "sr-4", status: "revoked",   patientId: "p3", orderNumber: "ZLZ-2024-004" },
  ];

  it("returns all orders with no filter", async () => {
    const repo = new MockOrderRepository(seed);
    const useCase = new GetOrders(repo);

    const result = await useCase.execute();

    expect(result.data).toHaveLength(4);
    expect(result.total).toBe(4);
  });

  it("filters by status", async () => {
    const repo = new MockOrderRepository(seed);
    const useCase = new GetOrders(repo);

    const result = await useCase.execute({ status: "draft" });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("sr-1");
  });

  it("filters by patientId", async () => {
    const repo = new MockOrderRepository(seed);
    const useCase = new GetOrders(repo);

    const result = await useCase.execute({ patientId: "p1" });

    expect(result.data).toHaveLength(2);
    expect(result.data.every((o) => o.patientId === "p1")).toBe(true);
  });

  it("paginates correctly", async () => {
    const repo = new MockOrderRepository(seed);
    const useCase = new GetOrders(repo);

    const page1 = await useCase.execute({ page: 1, pageSize: 2 });
    const page2 = await useCase.execute({ page: 2, pageSize: 2 });

    expect(page1.data).toHaveLength(2);
    expect(page2.data).toHaveLength(2);
    expect(page1.total).toBe(4);
  });
});

describe("CreateOrder use case", () => {
  it("creates an order and stores it in the repository", async () => {
    const repo = new MockOrderRepository();
    const useCase = new CreateOrder(repo);

    const created = await useCase.execute({ patientId: "p1", status: "draft" });

    expect(created.patientId).toBe("p1");
    expect(created.status).toBe("draft");
    expect(repo.createdOrders).toHaveLength(1);
  });

  it("assigns default status 'unknown' when status is missing", async () => {
    const repo = new MockOrderRepository();
    const useCase = new CreateOrder(repo);

    const created = await useCase.execute({ patientId: "p1" });

    expect(created.status).toBe("unknown");
  });
});
