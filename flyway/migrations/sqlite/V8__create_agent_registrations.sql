-- V8__create_agent_registrations.sql
-- Local Agent registration table.
-- Each registered clinic/practice gets a hashed API key for Bearer authentication.

CREATE TABLE IF NOT EXISTS "AgentRegistration" (
  "id"           TEXT     NOT NULL PRIMARY KEY,
  "name"         TEXT     NOT NULL,
  "orgFhirId"    TEXT     NOT NULL,
  "orgGln"       TEXT,
  "locationId"   TEXT,
  "apiKeyHash"   TEXT     NOT NULL,
  "apiKeyPrefix" TEXT     NOT NULL,
  "status"       TEXT     NOT NULL DEFAULT 'active',
  "lastSeenAt"   DATETIME,
  "agentVersion" TEXT,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AgentRegistration_orgFhirId_idx" ON "AgentRegistration"("orgFhirId");
CREATE INDEX IF NOT EXISTS "AgentRegistration_status_idx"    ON "AgentRegistration"("status");
