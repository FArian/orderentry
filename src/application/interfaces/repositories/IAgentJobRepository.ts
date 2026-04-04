import type { AgentJob, AgentJobType } from "@/domain/entities/AgentJob";

export interface CreateAgentJobInput {
  type:                AgentJobType;
  orgId:               string;
  locationId?:         string;
  documentReferenceId: string;
  serviceRequestId:    string;
  patientId:           string;
  orderNumber:         string;
  zpl:                 string;
}

export interface IAgentJobRepository {
  /** Create a new pending job. */
  create(input: CreateAgentJobInput): Promise<AgentJob>;

  /**
   * Return all pending jobs for an organization.
   * If locationId is given, returns jobs for that location + broadcast jobs (locationId = null).
   * If locationId is omitted, returns only broadcast jobs.
   */
  listPending(orgId: string, locationId?: string): Promise<AgentJob[]>;

  /** Mark a job as done. No-op if already done. */
  markDone(id: string): Promise<void>;

  /** Mark a job as failed. */
  markFailed(id: string): Promise<void>;
}
