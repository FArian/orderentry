/**
 * OrdersController — handles GET /api/service-requests and
 * DELETE /api/service-requests/{id}.
 *
 * The soft-delete fallback logic (409 → entered-in-error) lives here so it
 * is testable independently of the Next.js route machinery.
 */

import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import { createLogger, type Logger } from "@/infrastructure/logging/Logger";
import { FHIR_SYSTEMS } from "@/lib/fhir";
import type {
  DeleteOrderResponseDto,
  ListOrdersResponseDto,
  OrderResponseDto,
} from "../dto/OrderDto";

// ── Minimal FHIR types ────────────────────────────────────────────────────────
interface FhirIdentifier { system?: string; value?: string }
interface FhirCodeableConcept {
  text?: string;
  coding?: Array<{ system?: string; code?: string; display?: string }>;
}
interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status?: string;
  intent?: string;
  code?: FhirCodeableConcept;
  authoredOn?: string;
  identifier?: FhirIdentifier[];
  specimen?: Array<{ reference?: string }>;
  subject?: { reference?: string };
  meta?: { lastUpdated?: string };
}
interface FhirBundle<T = unknown> {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource?: T }>;
}
// ─────────────────────────────────────────────────────────────────────────────

function extractOrderNumber(ids?: FhirIdentifier[]): string {
  if (!ids) return "";
  const preferred = ids.find((i) => i.system === FHIR_SYSTEMS.orderNumbers);
  if (preferred?.value) return preferred.value;
  return ids.find((i) => i.value)?.value ?? "";
}

function extractPatientId(subject?: { reference?: string }): string {
  const ref = subject?.reference ?? "";
  return ref.startsWith("Patient/") ? ref.slice("Patient/".length) : "";
}

function mapServiceRequest(sr: FhirServiceRequest): OrderResponseDto {
  return {
    id: sr.id as string,
    status: sr.status ?? "",
    intent: sr.intent ?? "",
    codeText: sr.code?.text ?? sr.code?.coding?.[0]?.display ?? "",
    authoredOn: sr.authoredOn ?? sr.meta?.lastUpdated ?? "",
    orderNumber: extractOrderNumber(sr.identifier),
    specimenCount: Array.isArray(sr.specimen) ? sr.specimen.length : 0,
    patientId: extractPatientId(sr.subject),
  };
}

export class OrdersController {
  private readonly log: Logger;

  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
    logger?: Logger,
  ) {
    this.log = logger ?? createLogger("OrdersController");
  }

  async list(): Promise<ListOrdersResponseDto> {
    this.log.debug("list ServiceRequests");
    try {
      const url = new URL(`${this.fhirBase}/ServiceRequest`);
      url.searchParams.set("_sort", "-_lastUpdated");
      url.searchParams.set("_count", "50");

      const res = await this.fetchFn(url.toString(), {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });

      if (!res.ok) {
        this.log.error("FHIR ServiceRequest list failed", { status: res.status });
        return {
          data: [],
          total: 0,
          error: `FHIR error: ${res.status}`,
          httpStatus: res.status,
        };
      }

      const bundle = (await res.json()) as FhirBundle<FhirServiceRequest>;
      const data = (bundle.entry ?? [])
        .map((e) => e.resource)
        .filter(
          (r): r is FhirServiceRequest =>
            !!r && r.resourceType === "ServiceRequest" && !!r.id,
        )
        .map(mapServiceRequest);

      this.log.info("ServiceRequests fetched", { count: data.length });
      return { data, total: bundle.total ?? data.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("ServiceRequest list threw", { message });
      return { data: [], total: 0, error: message || "Network error", httpStatus: 500 };
    }
  }

  async delete(id: string): Promise<DeleteOrderResponseDto> {
    this.log.info("delete ServiceRequest", { id });
    try {
      // ── Attempt hard DELETE ─────────────────────────────────────────────────
      const res = await this.fetchFn(`${this.fhirBase}/ServiceRequest/${id}`, {
        method: "DELETE",
        headers: { accept: "application/fhir+json" },
      });

      if (res.ok || res.status === 204) {
        this.log.info("ServiceRequest hard-deleted", { id });
        return { deleted: true };
      }

      // ── 409 = referential integrity violation → soft-delete ─────────────────
      if (res.status === 409) {
        this.log.warn("ServiceRequest has references, falling back to soft-delete", { id });
        const getRes = await this.fetchFn(
          `${this.fhirBase}/ServiceRequest/${id}`,
          { headers: { accept: "application/fhir+json" }, cache: "no-store" },
        );
        if (!getRes.ok) {
          this.log.error("ServiceRequest GET for soft-delete failed", { id, status: getRes.status });
          return {
            deleted: false,
            error: `FHIR error: ${getRes.status}`,
            httpStatus: getRes.status,
          };
        }

        const sr = (await getRes.json()) as Record<string, unknown>;
        const updated = { ...sr, status: "entered-in-error" };
        const putRes = await this.fetchFn(
          `${this.fhirBase}/ServiceRequest/${id}`,
          {
            method: "PUT",
            headers: {
              accept: "application/fhir+json",
              "content-type": "application/fhir+json",
            },
            body: JSON.stringify(updated),
          },
        );

        if (!putRes.ok) {
          this.log.error("ServiceRequest soft-delete PUT failed", { id, status: putRes.status });
          return {
            deleted: false,
            error: `FHIR error: ${putRes.status}`,
            httpStatus: putRes.status,
          };
        }

        this.log.info("ServiceRequest soft-deleted (entered-in-error)", { id });
        return { deleted: true, soft: true };
      }

      this.log.error("ServiceRequest delete failed", { id, status: res.status });
      return {
        deleted: false,
        error: `FHIR error: ${res.status}`,
        httpStatus: res.status,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("ServiceRequest delete threw", { id, message });
      return { deleted: false, error: message || "Network error", httpStatus: 500 };
    }
  }
}

/** Production singleton — routes import this directly. */
export const ordersController = new OrdersController();
