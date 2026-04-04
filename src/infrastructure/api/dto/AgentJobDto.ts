/** POST /api/v1/agent/jobs/print — request body */
export interface CreatePrintJobRequestDto {
  /** FHIR Organization ID (e.g. "zlz") */
  orgId:               string;
  /** FHIR Location ID for targeted routing — omit for broadcast */
  locationId?:         string;
  /** FHIR DocumentReference ID (without "DocumentReference/" prefix) */
  documentReferenceId: string;
  /** FHIR ServiceRequest ID */
  serviceRequestId:    string;
  /** FHIR Patient ID */
  patientId:           string;
  /** Order number — used in ZPL barcode label */
  orderNumber:         string;
  /** Specimen list — one ZPL label per specimen */
  specimens:           Array<{ materialCode: string; materialName: string }>;
}

/** Single job returned in GET /api/v1/agent/jobs */
export interface AgentJobResponseDto {
  id:                  string;
  type:                "print" | "oru";
  orgId:               string;
  locationId:          string | null;
  documentReferenceId: string;
  serviceRequestId:    string;
  patientId:           string;
  orderNumber:         string;
  zpl:                 string;
  createdAt:           string;
}

/** GET /api/v1/agent/jobs — response body */
export interface ListAgentJobsResponseDto {
  jobs: AgentJobResponseDto[];
}

/** POST /api/v1/agent/jobs/print — response body */
export interface CreatePrintJobResponseDto {
  id:        string;
  status:    string;
  createdAt: string;
}

/** POST /api/v1/agent/jobs/[id]/done — response body */
export interface JobDoneResponseDto {
  id:     string;
  status: "done";
}
