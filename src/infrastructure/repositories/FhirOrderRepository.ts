import type {
  IOrderRepository,
  OrderSearchQuery,
  PagedOrders,
} from "@/application/interfaces/repositories/IOrderRepository";
import type { Order } from "@/domain/entities/Order";
import { HttpClient } from "@/infrastructure/api/HttpClient";

/** Shape returned by /api/service-requests */
interface ApiOrdersResponse {
  data: Order[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

/**
 * Repository implementation that delegates to the Next.js API route
 * /api/service-requests, which proxies to the FHIR server.
 *
 * Used client-side only.
 */
export class FhirOrderRepository implements IOrderRepository {
  private readonly http = new HttpClient();

  async search(query: OrderSearchQuery): Promise<PagedOrders> {
    const params: Record<string, string | undefined> = {
      status: query.status,
      patientId: query.patientId,
      page: query.page !== undefined ? String(query.page) : undefined,
      pageSize: query.pageSize !== undefined ? String(query.pageSize) : undefined,
    };
    const res = await this.http.get<ApiOrdersResponse>("/api/service-requests", params);
    if (res.error) throw new Error(res.error);
    const data = Array.isArray(res.data) ? res.data : [];
    return {
      data,
      total: res.total ?? data.length,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    };
  }

  async getById(id: string): Promise<Order | null> {
    try {
      const res = await this.http.get<{ data: Order }>(
        `/api/service-requests/${encodeURIComponent(id)}`,
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  async create(orderData: Partial<Order>): Promise<Order> {
    const res = await this.http.post<{ data: Order }>(
      "/api/service-requests",
      orderData,
    );
    return res.data;
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/service-requests/${encodeURIComponent(id)}`);
  }

  async submitBundle(bundle: Record<string, unknown>): Promise<string[]> {
    const res = await this.http.post<{ ids?: string[]; error?: string }>(
      "/api/orders/submit",
      bundle,
    );
    if (res.error) throw new Error(res.error);
    return res.ids ?? [];
  }
}
