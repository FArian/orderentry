import type { Order } from "@/domain/entities/Order";
import type { IOrderRepository } from "../interfaces/repositories/IOrderRepository";

/**
 * Use case: create a new lab order (ServiceRequest) in the FHIR server.
 */
export class CreateOrder {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(orderData: Partial<Order>): Promise<Order> {
    return this.repo.create(orderData);
  }
}
