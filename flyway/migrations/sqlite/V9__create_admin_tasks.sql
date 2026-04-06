-- V9__create_admin_tasks.sql
-- AdminTask table for system-generated admin notifications (e.g. pool threshold alerts).

CREATE TABLE IF NOT EXISTS "AdminTask" (
  "id"          TEXT     NOT NULL PRIMARY KEY,
  "type"        TEXT     NOT NULL,
  "severity"    TEXT     NOT NULL,
  "orgId"       TEXT,
  "serviceType" TEXT,
  "message"     TEXT     NOT NULL,
  "metadata"    TEXT     NOT NULL DEFAULT '{}',
  "status"      TEXT     NOT NULL DEFAULT 'OPEN',
  "resolvedAt"  DATETIME,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AdminTask_type_idx"   ON "AdminTask"("type");
CREATE INDEX IF NOT EXISTS "AdminTask_status_idx" ON "AdminTask"("status");
