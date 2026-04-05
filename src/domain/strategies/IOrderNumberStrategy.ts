/**
 * IOrderNumberStrategy — contract for service-type-specific order number generation.
 *
 * Domain rule: same input → same format; no I/O, no side effects.
 * Every new service type implements this interface and registers itself in
 * OrderNumberStrategyRegistry — no existing code changes needed.
 */

// ── Service types ─────────────────────────────────────────────────────────────

export const SERVICE_TYPES = ["MIBI", "ROUTINE", "POC"] as const;
export type ServiceType = typeof SERVICE_TYPES[number];

export function isServiceType(value: string): value is ServiceType {
  return SERVICE_TYPES.includes(value as ServiceType);
}

// ── Strategy interface ────────────────────────────────────────────────────────

export interface IOrderNumberStrategy {
  /** The service type this strategy handles. */
  readonly serviceType: ServiceType;

  /**
   * Generate a formatted order number from a sequential counter.
   * @param counter - positive integer from the number source (Orchestra / pool)
   */
  format(counter: number): string;

  /**
   * Validate that a string matches this strategy's format.
   * Returns true if valid, false otherwise.
   */
  isValid(value: string): boolean;
}
