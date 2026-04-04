-- V1: Create users table
-- SQL Server dialect — NVARCHAR, DATETIMEOFFSET, NVARCHAR(MAX) for JSON

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'User')
BEGIN
    CREATE TABLE [User] (
        id                       NVARCHAR(36)    NOT NULL PRIMARY KEY,
        username                 NVARCHAR(32)    NOT NULL,
        [passwordHash]           NVARCHAR(200)   NOT NULL,
        salt                     NVARCHAR(100)   NOT NULL,
        [createdAt]              DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        role                     NVARCHAR(20)    NOT NULL DEFAULT 'user',
        status                   NVARCHAR(20)    NOT NULL DEFAULT 'active',
        [providerType]           NVARCHAR(20)    NOT NULL DEFAULT 'local',
        [externalId]             NVARCHAR(200),
        [fhirSyncStatus]         NVARCHAR(20)    NOT NULL DEFAULT 'not_synced',
        [fhirSyncedAt]           DATETIMEOFFSET,
        [fhirSyncError]          NVARCHAR(MAX),
        [fhirPractitionerId]     NVARCHAR(100),
        [fhirPractitionerRoleId] NVARCHAR(100),
        [apiTokenHash]           NVARCHAR(200),
        [apiTokenCreatedAt]      DATETIMEOFFSET,
        profile                  NVARCHAR(MAX)   -- JSON stored as string (use ISJSON() for validation)
    );

    CREATE UNIQUE INDEX [User_username_key] ON [User](username);
END
