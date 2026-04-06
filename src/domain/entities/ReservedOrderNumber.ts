// Domain entity — a pre-reserved order number in the fallback pool.

import type { ServiceType } from "../strategies/IOrderNumberStrategy";

export type ReservedNumberStatus = "available" | "used";

export interface ReservedOrderNumber {
  id:                      string;
  number:                  string;
  serviceType:             ServiceType;
  status:                  ReservedNumberStatus;
  /** null = shared pool (any org); value = org-specific pool (FHIR Organization.id) */
  orgFhirId?:              string | null;
  usedAt?:                 string;
  usedForPatientId?:       string;
  usedForServiceRequestId?: string;
  createdAt:               string;
}

export interface ReservedNumberInput {
  number:      string;
  serviceType: ServiceType;
  /** null = shared pool; value = org-specific pool */
  orgFhirId?:  string | null;
}
