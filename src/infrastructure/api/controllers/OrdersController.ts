/**
 * OrdersController — handles GET /api/service-requests and
 * DELETE /api/service-requests/{id}.
 *
 * The list() method returns a FHIR searchset Bundle (pass-through from HAPI).
 * The soft-delete fallback logic (409 → entered-in-error) lives here so it
 * is testable independently of the Next.js route machinery.
 * Error responses are FHIR OperationOutcome.
 */

import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { createLogger, type Logger } from "@/infrastructure/logging/Logger";
import { OrderStatus } from "@/domain/entities/Order";
import {
  buildOperationOutcome,
  type FhirBundle,
  type FhirOperationOutcome,
} from "@/infrastructure/fhir/FhirTypes";
import type {
  DeleteOrderResponseDto,
  ListOrdersQueryDto,
} from "../dto/OrderDto";

// ── Minimal FHIR type scoped to this controller ───────────────────────────────
interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status?: string;
  [key: string]: unknown;
}

export type OrdersBundleResponse =
  | (FhirBundle<FhirServiceRequest> & { httpStatus?: number })
  | FhirOperationOutcome;

// ─────────────────────────────────────────────────────────────────────────────

export class OrdersController {
  private readonly log: Logger;

  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
    logger?: Logger,
  ) {
    this.log = logger ?? createLogger("OrdersController");
  }

  async list(query: ListOrdersQueryDto = {}): Promise<OrdersBundleResponse> {
    const { orgFhirId, orgGln } = query;

    // No org filter = internal lab user (ZLZ/ZetLab Systembetreiber) → sees all orders.
    // External Auftraggeber always have orgGln/orgFhirId configured → filtered to their org.

    this.log.debug("list ServiceRequests", { orgFhirId, orgGln });
    try {
      const url = new URL(`${this.fhirBase}/ServiceRequest`);
      if (orgFhirId) {
        url.searchParams.set("subject:Patient.organization", `Organization/${orgFhirId}`);
      } else if (orgGln) {
        url.searchParams.set("subject:Patient.organization:identifier", `${EnvConfig.fhirSystems.gln}|${orgGln}`);
      }
      url.searchParams.set("_count", "50");

      const res = await this.fetchFn(url.toString(), {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });

      if (!res.ok) {
        this.log.error("FHIR ServiceRequest list failed", { status: res.status });
        return buildOperationOutcome("error", "exception", `FHIR error: ${res.status}`, res.status);
      }

      const bundle = (await res.json()) as FhirBundle<FhirServiceRequest>;
      this.log.info("ServiceRequests fetched", { count: bundle.entry?.length ?? 0, total: bundle.total });
      return { ...bundle, type: "searchset" as const };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("ServiceRequest list threw", { message });
      return buildOperationOutcome("error", "exception", message || "Network error", 500);
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
          return { deleted: false, error: `FHIR error: ${getRes.status}`, httpStatus: getRes.status };
        }

        const sr = (await getRes.json()) as Record<string, unknown>;
        const updated = { ...sr, status: OrderStatus.ENTERED_IN_ERROR };
        const putRes = await this.fetchFn(
          `${this.fhirBase}/ServiceRequest/${id}`,
          {
            method: "PUT",
            headers: { accept: "application/fhir+json", "content-type": "application/fhir+json" },
            body: JSON.stringify(updated),
          },
        );

        if (!putRes.ok) {
          this.log.error("ServiceRequest soft-delete PUT failed", { id, status: putRes.status });
          return { deleted: false, error: `FHIR error: ${putRes.status}`, httpStatus: putRes.status };
        }

        this.log.info("ServiceRequest soft-deleted (entered-in-error)", { id });
        return { deleted: true, soft: true };
      }

      this.log.error("ServiceRequest delete failed", { id, status: res.status });
      return { deleted: false, error: `FHIR error: ${res.status}`, httpStatus: res.status };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("ServiceRequest delete threw", { id, message });
      return { deleted: false, error: message || "Network error", httpStatus: 500 };
    }
  }
}

/** Production singleton — routes import this directly. */
export const ordersController = new OrdersController();

