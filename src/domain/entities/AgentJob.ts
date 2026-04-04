export type AgentJobType   = "print" | "oru";
export type AgentJobStatus = "pending" | "done" | "failed";

/** Payload stored as JSON inside AgentJob.payload. */
export interface AgentJobPayload {
  /** FHIR DocumentReference ID — agent fetches PDF via /api/v1/proxy/fhir/document-references/{id} */
  documentReferenceId: string;
  serviceRequestId:    string;
  patientId:           string;
  orderNumber:         string;
  /** Pre-generated ZPL string for all specimen labels concatenated. */
  zpl:                 string;
}

export interface AgentJob {
  id:         string;
  type:       AgentJobType;
  status:     AgentJobStatus;
  /** FHIR Organization ID — mandatory routing key. */
  orgId:      string;
  /** FHIR Location ID — targeted routing. Null = broadcast to all agents of the org. */
  locationId: string | null;
  payload:    AgentJobPayload;
  createdAt:  string;
  updatedAt:  string;
  doneAt:     string | null;
}
