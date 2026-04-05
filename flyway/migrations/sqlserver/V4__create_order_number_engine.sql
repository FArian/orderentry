-- V4: Order Number Engine — SQL Server

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OrgRule')
CREATE TABLE OrgRule (
    id            NVARCHAR(36)  NOT NULL PRIMARY KEY,
    orgFhirId     NVARCHAR(255) NOT NULL UNIQUE,
    orgGln        NVARCHAR(255) NOT NULL UNIQUE,
    orgName       NVARCHAR(255) NOT NULL,
    patientPrefix NVARCHAR(20)  NOT NULL DEFAULT '',
    casePrefix    NVARCHAR(20)  NOT NULL DEFAULT '',
    hl7Msh3       NVARCHAR(100) NOT NULL DEFAULT '',
    hl7Msh4       NVARCHAR(100) NOT NULL DEFAULT '',
    hl7Msh5       NVARCHAR(100) NOT NULL DEFAULT 'ZLZ',
    hl7Msh6       NVARCHAR(100) NOT NULL DEFAULT 'LAB',
    createdAt     DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    updatedAt     DATETIME2     NOT NULL DEFAULT GETUTCDATE()
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReservedOrderNumber')
CREATE TABLE ReservedOrderNumber (
    id                      NVARCHAR(36)  NOT NULL PRIMARY KEY,
    number                  NVARCHAR(50)  NOT NULL UNIQUE,
    serviceType             NVARCHAR(20)  NOT NULL,
    status                  NVARCHAR(20)  NOT NULL DEFAULT 'available',
    usedAt                  DATETIME2,
    usedForPatientId        NVARCHAR(255),
    usedForServiceRequestId NVARCHAR(255),
    createdAt               DATETIME2     NOT NULL DEFAULT GETUTCDATE()
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PoolNotificationLog')
CREATE TABLE PoolNotificationLog (
    id             NVARCHAR(36)  NOT NULL PRIMARY KEY,
    level          NVARCHAR(10)  NOT NULL,
    sentAt         DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    remainingCount INT           NOT NULL,
    poolRefilled   BIT           NOT NULL DEFAULT 0
);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PoolThresholdConfig')
CREATE TABLE PoolThresholdConfig (
    id                NVARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT 'default',
    infoAt            INT           NOT NULL DEFAULT 30,
    warnAt            INT           NOT NULL DEFAULT 15,
    errorAt           INT           NOT NULL DEFAULT 5,
    notificationEmail NVARCHAR(500) NOT NULL DEFAULT ''
);

IF NOT EXISTS (SELECT * FROM PoolThresholdConfig WHERE id = 'default')
    INSERT INTO PoolThresholdConfig (id) VALUES ('default');
