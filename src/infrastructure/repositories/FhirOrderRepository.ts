import type {
  IOrderRepository,
  OrderSearchQuery,
  PagedOrders,
} from "@/application/interfaces/repositories/IOrderRepository";
import type { Order, OrderStatus } from "@/domain/entities/Order";
import { OrderFactory } from "@/domain/factories/OrderFactory";
import { resolveOrganizations } from "@/application/services/OrganizationResolver";
import { HttpClient } from "@/infrastructure/api/HttpClient";
import { type FhirBundle } from "@/infrastructure/fhir/FhirTypes";
import { FHIR_SYSTEMS } from "@/lib/fhir";
import { AppConfig } from "@/shared/config/AppConfig";
import { createClientLogger } from "@/shared/utils/clientLogger";

const log = createClientLogger("FhirOrderRepository");

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractOrderNumber(ids?: Array<{ system?: string; value?: string }>): string {
  if (!ids) return "";
  const preferred = ids.find((i) => i.system === FHIR_SYSTEMS.orderNumbers);
  if (preferred?.value) return preferred.value;
  return ids.find((i) => i.value)?.value ?? "";
}

// ── Minimal FHIR type for ServiceRequest ─────────────────────────────────────
interface FhirIdentifier { system?: string; value?: string }
interface FhirReference  { reference?: string; display?: string }
interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?:          string;
  status?:      string;
  intent?:      string;
  code?:        { text?: string; coding?: Array<{ display?: string }> };
  authoredOn?:  string;
  identifier?:  FhirIdentifier[];
  specimen?:    Array<{ reference?: string }>;
  subject?:     FhirReference;
  requester?:   FhirReference;
  performer?:   FhirReference[];
  meta?:        { lastUpdated?: string };
}

function mapToOrder(sr: FhirServiceRequest): Order {
  const patientRef = sr.subject?.reference ?? "";
  const patientId  = patientRef.startsWith("Patient/") ? patientRef.slice("Patient/".length) : "";

  const { sender, receivers } = resolveOrganizations(
    {
      ...(sr.requester !== undefined && { requester: sr.requester }),
      ...(sr.performer !== undefined && { performer: sr.performer }),
    },
    {},
    AppConfig.labOrgId,
  );

  return OrderFactory.create({
    id:            sr.id ?? "",
    ...(sr.status !== undefined && { status: sr.status as OrderStatus }),
    intent:        sr.intent ?? "",
    codeText:      sr.code?.text ?? sr.code?.coding?.[0]?.display ?? "",
    authoredOn:    sr.authoredOn ?? sr.meta?.lastUpdated ?? "",
    orderNumber:   extractOrderNumber(sr.identifier),
    specimenCount: Array.isArray(sr.specimen) ? sr.specimen.length : 0,
    patientId,
    ...(sender !== undefined && { sender }),
    receivers,
  });
}

/**
 * Repository implementation that delegates to the Next.js API route
 * /api/service-requests, which returns a FHIR searchset Bundle.
 *
 * Used client-side only.
 */
export class FhirOrderRepository implements IOrderRepository {
  private readonly http = new HttpClient();

  async search(query: OrderSearchQuery): Promise<PagedOrders> {
    const params: Record<string, string | undefined> = {
      status:    query.status,
      patientId: query.patientId,
      page:      query.page     !== undefined ? String(query.page)     : undefined,
      pageSize:  query.pageSize !== undefined ? String(query.pageSize) : undefined,
    };
    const bundle = await this.http.get<FhirBundle<FhirServiceRequest>>(
      "/api/service-requests",
      params,
    );

    const data = (bundle.entry ?? [])
      .map((e) => e.resource)
      .filter((r): r is FhirServiceRequest =>
        !!r && (r as { resourceType?: string }).resourceType === "ServiceRequest" && !!(r as { id?: string }).id,
      )
      .map(mapToOrder);

    return {
      data,
      total:    bundle.total ?? data.length,
      page:     query.page     ?? 1,
      pageSize: query.pageSize ?? 20,
    };
  }

  async getById(id: string): Promise<Order | null> {
    try {
      const res = await this.http.get<{ data: Order }>(
        `/api/service-requests/${encodeURIComponent(id)}`,
      );
      return res.data ?? null;
    } catch (err: unknown) {
      log.error("getById failed", { id, message: err instanceof Error ? err.message : String(err) });
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
