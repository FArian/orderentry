import type { ReservedOrderNumber }  from "@/domain/entities/ReservedOrderNumber";
import type { ServiceType }          from "@/domain/strategies/IOrderNumberStrategy";
import type { PoolThresholdData }    from "@/domain/valueObjects/PoolThreshold";
import type { PoolStats }            from "@/application/interfaces/repositories/IReservedNumberRepository";

export type ReservedOrderNumberDto    = ReservedOrderNumber;
export type ReservedNumberResponseDto = ReservedOrderNumber;
export type PoolStatsDto              = PoolStats;

export interface ListPoolResponseDto {
  data:  ReservedNumberResponseDto[];
  stats: PoolStats;
}

export interface AddNumbersDto {
  numbers:     string[];
  serviceType: ServiceType;
  /** Optional: assign to a specific FHIR Organisation. null/omit = shared pool. */
  orgFhirId?:  string | null;
}

export interface AddNumbersResponseDto {
  added:    number;
  rejected: string[];
  stats:    PoolStats;
}

export type PoolThresholdDto         = PoolThresholdData;
export type UpdatePoolThresholdDto   = PoolThresholdData;

export interface OrderNumberRequestDto {
  orgGln:      string;
  serviceType: ServiceType;
  patientId?:  string;
}

export interface OrderNumberResponseDto {
  orderNumber: string;
  serviceType: ServiceType;
  source:      "orchestra" | "pool";
}
