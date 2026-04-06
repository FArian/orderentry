/**
 * OrderNumberStrategyRegistry — Strategy Pattern registry.
 *
 * Centralises strategy lookup so new service types can be added by
 * registering a new strategy here — no other code changes required.
 *
 * Strategies are initialized with ENV-driven config so prefix / length
 * values come from environment variables, not hardcoded.
 */

import type { IOrderNumberStrategy } from "./IOrderNumberStrategy";
import { MibiStrategy }       from "./MibiStrategy";
import { RoutineStrategy }    from "./RoutineStrategy";
import { PocStrategy }        from "./PocStrategy";
import { PassthroughStrategy } from "./PassthroughStrategy";

class OrderNumberStrategyRegistry {
  private readonly registry = new Map<string, IOrderNumberStrategy>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(new MibiStrategy(
      process.env.ORDER_MI_PREFIX    ?? "MI",
      process.env.ORDER_MI_START     ?? "4",
      parseInt(process.env.ORDER_MI_LENGTH ?? "11", 10),
    ));
    this.register(new RoutineStrategy(
      parseInt(process.env.ORDER_ROUTINE_LENGTH ?? "10", 10),
    ));
    this.register(new PocStrategy(
      process.env.ORDER_POC_PREFIX ?? "PO",
      parseInt(process.env.ORDER_POC_LENGTH ?? "7", 10),
    ));
  }

  register(strategy: IOrderNumberStrategy): void {
    this.registry.set(strategy.serviceType, strategy);
  }

  /**
   * Resolve the strategy for a given service type.
   * For built-in types (MIBI, ROUTINE, POC) returns the registered strategy.
   * For unknown/dynamic types returns a PassthroughStrategy so new service types
   * work without any code change.
   */
  resolve(serviceType: string): IOrderNumberStrategy {
    return this.registry.get(serviceType) ?? new PassthroughStrategy(serviceType);
  }

  listServiceTypes(): string[] {
    return Array.from(this.registry.keys());
  }
}

/** Module-level singleton — import this in infrastructure/application code. */
export const orderNumberStrategyRegistry = new OrderNumberStrategyRegistry();
