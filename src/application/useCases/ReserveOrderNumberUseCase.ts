/**
 * ReserveOrderNumberUseCase — admin batch-loads numbers into the fallback pool.
 *
 * Validates each number against the strategy for its service type.
 * Duplicate numbers (unique constraint) are silently skipped.
 */

import type { ServiceType }               from "@/domain/strategies/IOrderNumberStrategy";
import { orderNumberStrategyRegistry }    from "@/domain/strategies/OrderNumberStrategyRegistry";
import type { IReservedNumberRepository } from "../interfaces/repositories/IReservedNumberRepository";
import type { IPoolNotificationService }  from "../interfaces/services/IPoolNotificationService";

export interface ReserveNumbersInput {
  numbers:     string[];
  serviceType: ServiceType;
  /** Optional: assign numbers to a specific FHIR Organisation. null/omit = shared pool. */
  orgFhirId?:  string | null;
}

export interface ReserveNumbersResult {
  added:    number;
  rejected: string[];
}

export class ReserveOrderNumberUseCase {
  constructor(
    private readonly pool:          IReservedNumberRepository,
    private readonly notifications: IPoolNotificationService,
  ) {}

  async execute(input: ReserveNumbersInput): Promise<ReserveNumbersResult> {
    const { numbers, serviceType, orgFhirId } = input;
    const strategy  = orderNumberStrategyRegistry.resolve(serviceType);
    const valid:    { number: string; serviceType: ServiceType; orgFhirId?: string | null }[] = [];
    const rejected: string[] = [];

    for (const n of numbers) {
      if (strategy.isValid(n.trim())) {
        valid.push({ number: n.trim(), serviceType, orgFhirId: orgFhirId ?? null });
      } else {
        rejected.push(n.trim());
      }
    }

    const added = valid.length > 0 ? await this.pool.addMany(valid) : 0;

    // After refill, reset the anti-spam log so notifications can fire again.
    if (added > 0) await this.notifications.recordRefill();

    return { added, rejected };
  }
}
