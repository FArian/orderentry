import type { IOrderNumberStrategy } from "./IOrderNumberStrategy";

/**
 * MIBI (Mikrobiologie) order number strategy.
 * Format: MI4XXXXXXXX — prefix "MI", start digit "4", total 11 characters.
 * Example: MI40030020 → MI400300200
 *
 * Prefix, start digit and total length are configurable via constructor (defaults from ENV).
 */
export class MibiStrategy implements IOrderNumberStrategy {
  readonly serviceType = "MIBI" as const;

  constructor(
    private readonly prefix: string = "MI",
    private readonly startDigit: string = "4",
    private readonly totalLength: number = 11,
  ) {}

  format(counter: number): string {
    const body = String(counter).padStart(
      this.totalLength - this.prefix.length - this.startDigit.length,
      "0",
    );
    return `${this.prefix}${this.startDigit}${body}`;
  }

  isValid(value: string): boolean {
    const expected = this.totalLength;
    return (
      value.startsWith(this.prefix + this.startDigit) &&
      value.length === expected &&
      /^\d+$/.test(value.slice(this.prefix.length))
    );
  }
}
