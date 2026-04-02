import type {
  IOrderRepository,
  OrderSearchQuery,
  PagedOrders,
} from "@/application/interfaces/repositories/IOrderRepository";

/**
 * Use case: retrieve a paginated list of lab orders (ServiceRequests).
 */
export class GetOrders {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(query: OrderSearchQuery = {}): Promise<PagedOrders> {
    return this.repo.search(query);
  }
}
