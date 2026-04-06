// Domain entity — internal admin task for system observability.
// No framework dependencies, no I/O.

export type AdminTaskType     = "ORDER_NUMBER_POOL_ALERT";
export type AdminTaskSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AdminTaskStatus   = "OPEN" | "RESOLVED";

export interface AdminTask {
  id:           string;
  type:         AdminTaskType;
  severity:     AdminTaskSeverity;
  /** FHIR Organisation ID if the alert is org-specific. */
  orgId?:       string | undefined;
  /** ServiceType (MIBI, ROUTINE, POC, …) this alert belongs to. */
  serviceType?: string | undefined;
  message:      string;
  /** Arbitrary JSON metadata (pool count, threshold level, …). */
  metadata:     Record<string, unknown>;
  status:       AdminTaskStatus;
  resolvedAt?:  string | undefined;
  createdAt:    string;
  updatedAt:    string;
}

export type AdminTaskInput = Omit<AdminTask, "id" | "status" | "resolvedAt" | "createdAt" | "updatedAt">;
