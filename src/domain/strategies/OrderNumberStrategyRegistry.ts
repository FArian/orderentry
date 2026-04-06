/**
 * OrderNumberStrategyRegistry — Strategy Pattern registry.
 *
 * Centralises strategy lookup so new service types can be added by
 * registering a new strategy here — no other code changes required.
 *
 * Pure domain: no I/O, no process.env.
 * Configuration is injected via StrategyConfig or by calling register()
 * from the infrastructure layer after construction.
 */

import type { IOrderNumberStrategy } from "./IOrderNumberStrategy";
import { MibiStrategy }              from "./MibiStrategy";
import { RoutineStrategy }           from "./RoutineStrategy";
import { PocStrategy }               from "./PocStrategy";
import { PassthroughStrategy }       from "./PassthroughStrategy";

/** Config values for the built-in strategies. All fields are optional. */
export interface StrategyConfig {
  mibiPrefix?:    string;
  mibiStart?:     string;
  mibiLength?:    number;
  routineLength?: number;
  pocPrefix?:     string;
  pocLength?:     number;
}

class OrderNumberStrategyRegistry {
  private readonly registry = new Map<string, IOrderNumberStrategy>();

  constructor(config: StrategyConfig = {}) {
    this.registerDefaults(config);
  }

  private registerDefaults(config: StrategyConfig): void {
    this.register(new MibiStrategy(
      config.mibiPrefix    ?? "MI",
      config.mibiStart     ?? "4",
      config.mibiLength    ?? 11,
    ));
    this.register(new RoutineStrategy(
      config.routineLength ?? 10,
    ));
    this.register(new PocStrategy(
      config.pocPrefix     ?? "PO",
      config.pocLength     ?? 7,
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

/**
 * Module-level singleton with pure strategy defaults.
 *
 * Infrastructure code must call register() with ENV-configured strategies
 * before this registry is first used in a request context.
 * See: infrastructure/services/OrderNumberStrategyConfig.ts
 */
export const orderNumberStrategyRegistry = new OrderNumberStrategyRegistry();
