import { GetOrders } from "../useCases/GetOrders";
import { CreateOrder } from "../useCases/CreateOrder";
import type { IOrderRepository } from "../interfaces/repositories/IOrderRepository";
import type {
  OrderSearchQuery,
  PagedOrders,
} from "../interfaces/repositories/IOrderRepository";
import type { Order } from "@/domain/entities/Order";

/**
 * Application service that orchestrates order-related use cases.
 */
export class OrderService {
  private readonly getOrders: GetOrders;
  private readonly createOrder: CreateOrder;

  constructor(private readonly repo: IOrderRepository) {
    this.getOrders = new GetOrders(repo);
    this.createOrder = new CreateOrder(repo);
  }

  list(query: OrderSearchQuery = {}): Promise<PagedOrders> {
    return this.getOrders.execute(query);
  }

  create(orderData: Partial<Order>): Promise<Order> {
    return this.createOrder.execute(orderData);
  }

  /**
   * Submits a FHIR transaction bundle via the server proxy.
   * Transitional method — bundle construction will move to infrastructure in a future step.
   */
  submitBundle(bundle: Record<string, unknown>): Promise<string[]> {
    return this.repo.submitBundle(bundle);
  }
}
