-- V3: AgentJob — print and ORU jobs queued for Local Agent polling
--
-- payload: JSON string { documentReferenceId, serviceRequestId, patientId, orderNumber, zpl }
-- orgId:      FHIR Organization ID (routing — mandatory)
-- locationId: FHIR Location ID (targeted routing — nullable = broadcast)

CREATE TABLE IF NOT EXISTS AgentJob (
  id          TEXT     NOT NULL PRIMARY KEY,
  type        TEXT     NOT NULL,                          -- 'print' | 'oru'
  status      TEXT     NOT NULL DEFAULT 'pending',        -- 'pending' | 'done' | 'failed'
  orgId       TEXT     NOT NULL,
  locationId  TEXT,
  payload     TEXT     NOT NULL,
  createdAt   DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt   DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  doneAt      DATETIME
);

CREATE INDEX IF NOT EXISTS idx_agent_job_status_org ON AgentJob (status, orgId);
CREATE INDEX IF NOT EXISTS idx_agent_job_status_loc ON AgentJob (status, orgId, locationId);
