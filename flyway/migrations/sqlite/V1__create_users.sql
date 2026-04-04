-- V1: Create users table
-- SQLite dialect — TEXT for all string/date fields, no JSONB

CREATE TABLE IF NOT EXISTS "User" (
    id                       TEXT NOT NULL PRIMARY KEY,
    username                 TEXT NOT NULL,
    "passwordHash"           TEXT NOT NULL,
    salt                     TEXT NOT NULL,
    "createdAt"              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    role                     TEXT NOT NULL DEFAULT 'user',
    status                   TEXT NOT NULL DEFAULT 'active',
    "providerType"           TEXT NOT NULL DEFAULT 'local',
    "externalId"             TEXT,
    "fhirSyncStatus"         TEXT NOT NULL DEFAULT 'not_synced',
    "fhirSyncedAt"           TEXT,
    "fhirSyncError"          TEXT,
    "fhirPractitionerId"     TEXT,
    "fhirPractitionerRoleId" TEXT,
    "apiTokenHash"           TEXT,
    "apiTokenCreatedAt"      TEXT,
    profile                  TEXT   -- JSON serialized as string (SQLite has no JSONB)
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"(username);
