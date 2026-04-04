-- V1: Create users table
-- PostgreSQL dialect — TIMESTAMPTZ and JSONB for native types

CREATE TABLE IF NOT EXISTS "User" (
    id                       TEXT        NOT NULL PRIMARY KEY,
    username                 TEXT        NOT NULL,
    "passwordHash"           TEXT        NOT NULL,
    salt                     TEXT        NOT NULL,
    "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    role                     TEXT        NOT NULL DEFAULT 'user',
    status                   TEXT        NOT NULL DEFAULT 'active',
    "providerType"           TEXT        NOT NULL DEFAULT 'local',
    "externalId"             TEXT,
    "fhirSyncStatus"         TEXT        NOT NULL DEFAULT 'not_synced',
    "fhirSyncedAt"           TIMESTAMPTZ,
    "fhirSyncError"          TEXT,
    "fhirPractitionerId"     TEXT,
    "fhirPractitionerRoleId" TEXT,
    "apiTokenHash"           TEXT,
    "apiTokenCreatedAt"      TIMESTAMPTZ,
    profile                  JSONB       -- native JSONB for efficient querying
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"(LOWER(username));
