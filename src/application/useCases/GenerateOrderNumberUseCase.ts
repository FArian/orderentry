/**
 * GenerateOrderNumberUseCase
 *
 * Priority:
 *   1. Orchestra/LIS → formatted via strategy (org-specific override if set)
 *   2. Org-specific pre-reserved pool → returned as-is
 *   3. Shared pre-reserved pool → returned as-is
 *   4. Pool empty → throws OrderBlockedError
 *
 * Org-specific strategy overrides:
 *   If an OrgRule exists for the requesting organisation (looked up by GLN),
 *   and it specifies prefix/length overrides, those take priority over the
 *   global ENV-driven defaults.
 *
 * Service type mapping:
 *   If an OrgRule has a serviceTypeMapping entry for the requested serviceType,
 *   the mapped type is used instead. Allows external codes / department names
 *   to be translated to MIBI | ROUTINE | POC transparently.
 */

import type { ServiceType }               from "@/domain/strategies/IOrderNumberStrategy";
import { orderNumberStrategyRegistry }    from "@/domain/strategies/OrderNumberStrategyRegistry";
import { MibiStrategy }                  from "@/domain/strategies/MibiStrategy";
import { RoutineStrategy }               from "@/domain/strategies/RoutineStrategy";
import { PocStrategy }                   from "@/domain/strategies/PocStrategy";
import type { OrgRule }                  from "@/domain/entities/OrgRule";
import type { IOrchestraOrderService }   from "../interfaces/services/IOrchestraOrderService";
import type { IReservedNumberRepository } from "../interfaces/repositories/IReservedNumberRepository";
import type { IPoolNotificationService } from "../interfaces/services/IPoolNotificationService";
import type { IOrgRuleRepository }       from "../interfaces/repositories/IOrgRuleRepository";

export interface GenerateOrderNumberInput {
  orgGln:      string;
  serviceType: ServiceType;
  /** Optional — recorded in pool entry for audit. */
  patientId?:  string;
}

export interface GenerateOrderNumberResult {
  orderNumber: string;
  serviceType: ServiceType;
  source:      "orchestra" | "pool";
}

export class OrderBlockedError extends Error {
  constructor() {
    super("Kein Nummernpool verfügbar. Bestellung nicht möglich.");
    this.name = "OrderBlockedError";
  }
}

/** Build an org-specific strategy if the OrgRule overrides any defaults. */
function resolveStrategy(serviceType: ServiceType, rule: OrgRule | null) {
  const global = orderNumberStrategyRegistry.resolve(serviceType);
  if (!rule) return global;

  if (serviceType === "MIBI") {
    const prefix = rule.mibiPrefix || (global as MibiStrategy & { prefix?: string })["prefix"] as string || "MI";
    const start  = rule.mibiStart  || "4";
    const length = rule.mibiLength ?? undefined;
    if (rule.mibiPrefix || rule.mibiStart || rule.mibiLength) {
      return new MibiStrategy(prefix, start, length ?? 10);
    }
  }
  if (serviceType === "POC") {
    if (rule.pocPrefix || rule.pocLength) {
      return new PocStrategy(rule.pocPrefix || "PO", rule.pocLength ?? 7);
    }
  }
  if (serviceType === "ROUTINE") {
    if (rule.routineLength) {
      return new RoutineStrategy(rule.routineLength);
    }
  }
  return global;
}

/** Resolve service type through org mapping (e.g. "MIKRO" → "MIBI"). */
function resolveServiceType(requested: ServiceType, rule: OrgRule | null): ServiceType {
  if (!rule) return requested;
  return rule.serviceTypeMapping[requested] ?? requested;
}

export class GenerateOrderNumberUseCase {
  constructor(
    private readonly orchestra:     IOrchestraOrderService,
    private readonly pool:          IReservedNumberRepository,
    private readonly notifications: IPoolNotificationService,
    private readonly orgRules?:     IOrgRuleRepository,
  ) {}

  async execute(input: GenerateOrderNumberInput): Promise<GenerateOrderNumberResult> {
    const { orgGln, patientId } = input;

    // Load org rule (optional — falls back gracefully to global defaults if not found)
    const rule = this.orgRules && orgGln
      ? await this.orgRules.findByGln(orgGln).catch(() => null)
      : null;

    const serviceType = resolveServiceType(input.serviceType, rule);
    const strategy    = resolveStrategy(serviceType, rule);
    const orgFhirId   = rule?.orgFhirId ?? null;

    // 1. Try Orchestra
    const orchestraResult = await this.orchestra.requestNumber(orgGln, serviceType);
    if (orchestraResult !== null) {
      return {
        orderNumber: strategy.format(orchestraResult.counter),
        serviceType,
        source: "orchestra",
      };
    }

    // 2. Try org-specific pool first, then shared pool
    const reserved = orgFhirId
      ? (await this.pool.findNext(serviceType, orgFhirId)) ??
        (await this.pool.findNext(serviceType, null))
      : await this.pool.findNext(serviceType, null);

    if (!reserved) throw new OrderBlockedError();

    await this.pool.markUsed(reserved.id, patientId);

    const remaining = await this.pool.countAvailable(serviceType);
    await this.notifications.checkAndNotify(
      remaining,
      serviceType,
      ...(orgFhirId !== null ? [orgFhirId] : []),
    );

    return {
      orderNumber: reserved.number,
      serviceType,
      source: "pool",
    };
  }
}
