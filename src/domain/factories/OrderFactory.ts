import type { Order, OrderStatus } from "@/domain/entities/Order";

const VALID_STATUSES: readonly OrderStatus[] = [
  "draft",
  "active",
  "on-hold",
  "completed",
  "revoked",
  "entered-in-error",
];

/**
 * Factory — centralises Order entity creation.
 *
 * Design pattern: Factory Method / Static Factory
 */
export class OrderFactory {
  /**
   * Create an Order from a partial / unknown-shape object.
   * Provides safe defaults for every required field.
   */
  static create(data: Partial<Order>): Order {
    return {
      id: data.id ?? "",
      orderNumber: data.orderNumber ?? "",
      status: OrderFactory.toStatus(data.status),
      intent: data.intent ?? "order",
      patientId: data.patientId ?? "",
      authoredOn: data.authoredOn ?? "",
      codeText: data.codeText ?? "",
      specimenCount: typeof data.specimenCount === "number" ? data.specimenCount : 0,
    };
  }

  /**
   * Create a "draft" order pre-filled with minimal required data.
   * Useful for the order-entry form initial state.
   */
  static createDraft(patientId: string): Order {
    return OrderFactory.create({ patientId, status: "draft", intent: "order" });
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private static toStatus(raw: unknown): OrderStatus {
    return (VALID_STATUSES as readonly string[]).includes(String(raw ?? ""))
      ? (raw as OrderStatus)
      : "unknown";
  }
}
