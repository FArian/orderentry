import { GetOrders } from "@/application/useCases/GetOrders";
import { CreateOrder } from "@/application/useCases/CreateOrder";
import { MockOrderRepository } from "../../../mocks/MockOrderRepository";
import type { Order } from "@/domain/entities/Order";
import { OrderStatus } from "@/domain/entities/Order";

describe("GetOrders use case", () => {
  const seed: Partial<Order>[] = [
    { id: "sr-1", status: OrderStatus.DRAFT,     patientId: "p1", orderNumber: "ZLZ-2024-001" },
    { id: "sr-2", status: OrderStatus.ACTIVE,    patientId: "p2", orderNumber: "ZLZ-2024-002" },
    { id: "sr-3", status: OrderStatus.COMPLETED, patientId: "p1", orderNumber: "ZLZ-2024-003" },
    { id: "sr-4", status: OrderStatus.CANCELLED, patientId: "p3", orderNumber: "ZLZ-2024-004" },
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

    const result = await useCase.execute({ status: OrderStatus.DRAFT });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe("sr-1");
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

    const created = await useCase.execute({ patientId: "p1", status: OrderStatus.DRAFT });

    expect(created.patientId).toBe("p1");
    expect(created.status).toBe(OrderStatus.DRAFT);
    expect(repo.createdOrders).toHaveLength(1);
  });

  it("assigns default status 'unknown' when status is missing", async () => {
    const repo = new MockOrderRepository();
    const useCase = new CreateOrder(repo);

    const created = await useCase.execute({ patientId: "p1" });

    expect(created.status).toBe(OrderStatus.UNKNOWN);
  });
});
