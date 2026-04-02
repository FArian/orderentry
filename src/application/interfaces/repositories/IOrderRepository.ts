import type { Order } from "@/domain/entities/Order";

export interface OrderSearchQuery {
  status?: string;
  patientId?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedOrders {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IOrderRepository {
  search(query: OrderSearchQuery): Promise<PagedOrders>;
  getById(id: string): Promise<Order | null>;
  create(orderData: Partial<Order>): Promise<Order>;
  delete(id: string): Promise<void>;
}
