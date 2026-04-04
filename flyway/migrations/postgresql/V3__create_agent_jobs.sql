-- V3: AgentJob — print and ORU jobs queued for Local Agent polling

CREATE TABLE IF NOT EXISTS "AgentJob" (
  id           TEXT        NOT NULL PRIMARY KEY,
  type         TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending',
  "orgId"      TEXT        NOT NULL,
  "locationId" TEXT,
  payload      TEXT        NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "doneAt"     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_job_status_org ON "AgentJob" (status, "orgId");
CREATE INDEX IF NOT EXISTS idx_agent_job_status_loc ON "AgentJob" (status, "orgId", "locationId");
