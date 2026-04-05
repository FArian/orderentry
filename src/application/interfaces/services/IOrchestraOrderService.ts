import type { ServiceType } from "@/domain/strategies/IOrderNumberStrategy";

export interface OrchestraOrderNumberResult {
  /** The raw counter returned by Orchestra/LIS (e.g. 4000001). */
  counter:     number;
  serviceType: ServiceType;
}

/**
 * Interface for requesting order numbers from Orchestra/LIS.
 * Returns null when Orchestra is unreachable — callers fall back to the pool.
 */
export interface IOrchestraOrderService {
  requestNumber(
    orgGln:      string,
    serviceType: ServiceType,
  ): Promise<OrchestraOrderNumberResult | null>;
}
