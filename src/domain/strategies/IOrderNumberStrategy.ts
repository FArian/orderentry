/**
 * IOrderNumberStrategy — contract for service-type-specific order number generation.
 *
 * Domain rule: same input → same format; no I/O, no side effects.
 * Every new service type implements this interface and registers itself in
 * OrderNumberStrategyRegistry — no existing code changes needed.
 */

// ── Service types ─────────────────────────────────────────────────────────────

export const SERVICE_TYPES = ["MIBI", "ROUTINE", "POC"] as const;
export type KnownServiceType = typeof SERVICE_TYPES[number];

/**
 * Open string type — allows dynamic service types beyond the built-in three
 * (MIBI, ROUTINE, POC). New types (e.g. "GER", "CARDIO") require no code
 * changes — they fall through to PassthroughStrategy automatically.
 */
export type ServiceType = string;

/** Returns true only for the three built-in types. */
export function isKnownServiceType(value: string): value is KnownServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(value);
}

/** @deprecated Use isKnownServiceType. Will be removed in a future version. */
export function isServiceType(value: string): value is KnownServiceType {
  return isKnownServiceType(value);
}

// ── Strategy interface ────────────────────────────────────────────────────────

export interface IOrderNumberStrategy {
  /** The service type this strategy handles (any string). */
  readonly serviceType: string;

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
