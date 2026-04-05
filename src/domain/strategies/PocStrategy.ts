import type { IOrderNumberStrategy } from "./IOrderNumberStrategy";

/**
 * POC (Point of Care) order number strategy.
 * Format: prefix + zero-padded counter.
 * Example: PO00001
 */
export class PocStrategy implements IOrderNumberStrategy {
  readonly serviceType = "POC" as const;

  constructor(
    private readonly prefix: string = "PO",
    private readonly totalLength: number = 7,
  ) {}

  format(counter: number): string {
    const body = String(counter).padStart(
      this.totalLength - this.prefix.length,
      "0",
    );
    return `${this.prefix}${body}`;
  }

  isValid(value: string): boolean {
    return (
      value.startsWith(this.prefix) &&
      value.length === this.totalLength &&
      /^\d+$/.test(value.slice(this.prefix.length))
    );
  }
}
