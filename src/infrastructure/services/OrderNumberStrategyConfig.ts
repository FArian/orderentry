/**
 * OrderNumberStrategyConfig — infrastructure initializer for the domain strategy registry.
 *
 * Reads ENV-driven config from EnvConfig and re-registers the built-in strategies
 * on the domain singleton with the correct values.
 *
 * Import this file once from NumberPoolController (or any infrastructure entry point)
 * before the registry is first used in a request context.
 * The re-registration is idempotent — safe to import multiple times.
 */

import { orderNumberStrategyRegistry } from "@/domain/strategies/OrderNumberStrategyRegistry";
import { MibiStrategy }                from "@/domain/strategies/MibiStrategy";
import { RoutineStrategy }             from "@/domain/strategies/RoutineStrategy";
import { PocStrategy }                 from "@/domain/strategies/PocStrategy";
import { EnvConfig }                   from "../config/EnvConfig";

orderNumberStrategyRegistry.register(new MibiStrategy(
  EnvConfig.orderMiPrefix,
  EnvConfig.orderMiStart,
  EnvConfig.orderMiLength,
));

orderNumberStrategyRegistry.register(new RoutineStrategy(
  EnvConfig.orderRoutineLength,
));

orderNumberStrategyRegistry.register(new PocStrategy(
  EnvConfig.orderPocPrefix,
  EnvConfig.orderPocLength,
));
