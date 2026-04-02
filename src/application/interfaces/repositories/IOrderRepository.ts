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
  /**
   * Submits a FHIR transaction bundle (Encounter + ServiceRequest + Specimen + DocumentReference)
   * via the Next.js server proxy. Returns the resource locations from the FHIR bundle response.
   *
   * This is a transitional method — the bundle is still constructed in the UI layer (legacy).
   * Future work: move bundle construction into infrastructure/fhir/OrderSubmissionMapper.ts.
   */
  submitBundle(bundle: Record<string, unknown>): Promise<string[]>;
}
