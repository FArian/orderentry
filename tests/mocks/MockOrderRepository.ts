import type {
  IOrderRepository,
  OrderSearchQuery,
  PagedOrders,
} from "@/application/interfaces/repositories/IOrderRepository";
import type { Order } from "@/domain/entities/Order";
import { OrderFactory } from "@/domain/factories/OrderFactory";

/**
 * In-memory mock for IOrderRepository.
 * Use this in unit tests to avoid real FHIR API calls.
 *
 * @example
 * const repo = new MockOrderRepository([
 *   OrderFactory.create({ id: "sr-1", status: "draft", patientId: "p1" }),
 * ]);
 * const service = new OrderService(repo);
 */
export class MockOrderRepository implements IOrderRepository {
  private data: Order[];

  /** Track delete calls for assertion in tests */
  readonly deletedIds: string[] = [];

  /** Track create calls */
  readonly createdOrders: Order[] = [];

  constructor(seed: Partial<Order>[] = []) {
    this.data = seed.map((d) => OrderFactory.create(d));
  }

  async search(query: OrderSearchQuery): Promise<PagedOrders> {
    let filtered = [...this.data];

    if (query.status) {
      filtered = filtered.filter((o) => o.status === query.status);
    }
    if (query.patientId) {
      filtered = filtered.filter((o) => o.patientId === query.patientId);
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

  async getById(id: string): Promise<Order | null> {
    return this.data.find((o) => o.id === id) ?? null;
  }

  async create(orderData: Partial<Order>): Promise<Order> {
    const order = OrderFactory.create({ ...orderData, id: `mock-${Date.now()}` });
    this.data.push(order);
    this.createdOrders.push(order);
    return order;
  }

  async delete(id: string): Promise<void> {
    this.deletedIds.push(id);
    this.data = this.data.filter((o) => o.id !== id);
  }

  /** Track submitBundle calls for assertion in tests */
  readonly submittedBundles: Record<string, unknown>[] = [];

  async submitBundle(bundle: Record<string, unknown>): Promise<string[]> {
    this.submittedBundles.push(bundle);
    return ["mock-id-1"];
  }

  seed(items: Partial<Order>[]): void {
    this.data.push(...items.map((d) => OrderFactory.create(d)));
  }

  reset(items: Partial<Order>[] = []): void {
    this.data = items.map((d) => OrderFactory.create(d));
    this.deletedIds.length = 0;
    this.createdOrders.length = 0;
    this.submittedBundles.length = 0;
  }
}
