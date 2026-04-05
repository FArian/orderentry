import type { ReservedOrderNumber, ReservedNumberInput } from "@/domain/entities/ReservedOrderNumber";
import type { ServiceType } from "@/domain/strategies/IOrderNumberStrategy";
import type { PoolThresholdData } from "@/domain/valueObjects/PoolThreshold";

export interface PoolStats {
  total:     number;
  available: number;
  used:      number;
}

export interface IReservedNumberRepository {
  findAll(): Promise<ReservedOrderNumber[]>;

  /**
   * Find the next available number for the given service type.
   * Lookup priority:
   *   1. Org-specific pool (orgFhirId matches)
   *   2. Shared pool (orgFhirId IS NULL)
   * Pass null/undefined to search shared pool only.
   */
  findNext(serviceType: ServiceType, orgFhirId?: string | null): Promise<ReservedOrderNumber | null>;

  markUsed(id: string, patientId?: string, serviceRequestId?: string): Promise<ReservedOrderNumber>;
  addMany(numbers: ReservedNumberInput[]): Promise<number>;
  delete(id: string): Promise<void>;
  stats(): Promise<PoolStats>;
  countAvailable(): Promise<number>;

  // Threshold config (stored alongside pool in DB)
  getThresholds(): Promise<PoolThresholdData>;
  setThresholds(data: PoolThresholdData): Promise<void>;
}
