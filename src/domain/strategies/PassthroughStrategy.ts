import type { IOrderNumberStrategy } from "./IOrderNumberStrategy";

/**
 * PassthroughStrategy — fallback for unknown / dynamic service types.
 *
 * Returns the Orchestra counter as a plain decimal string.
 * Allows new service types (e.g. "GER", "CARDIO") to work without requiring
 * a dedicated strategy implementation. Register a proper strategy when
 * organisation-specific formatting is needed.
 */
export class PassthroughStrategy implements IOrderNumberStrategy {
  readonly serviceType: string;

  constructor(serviceType: string) {
    this.serviceType = serviceType;
  }

  format(counter: number): string {
    return String(counter);
  }

  isValid(value: string): boolean {
    return value.length > 0;
  }
}
