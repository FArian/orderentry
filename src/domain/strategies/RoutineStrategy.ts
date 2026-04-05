import type { IOrderNumberStrategy } from "./IOrderNumberStrategy";

/**
 * ROUTINE order number strategy.
 * Format: pure numeric, no prefix, fixed length (default 10).
 * Example: 7004003000
 */
export class RoutineStrategy implements IOrderNumberStrategy {
  readonly serviceType = "ROUTINE" as const;

  constructor(private readonly totalLength: number = 10) {}

  format(counter: number): string {
    return String(counter).padStart(this.totalLength, "0");
  }

  isValid(value: string): boolean {
    return value.length === this.totalLength && /^\d+$/.test(value);
  }
}
