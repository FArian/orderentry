-- V4: Order Number Engine — OrgRule, ReservedOrderNumber, PoolNotificationLog, PoolThresholdConfig

CREATE TABLE IF NOT EXISTS OrgRule (
    id            TEXT NOT NULL PRIMARY KEY,
    orgFhirId     TEXT NOT NULL UNIQUE,
    orgGln        TEXT NOT NULL UNIQUE,
    orgName       TEXT NOT NULL,
    patientPrefix TEXT NOT NULL DEFAULT '',
    casePrefix    TEXT NOT NULL DEFAULT '',
    hl7Msh3       TEXT NOT NULL DEFAULT '',
    hl7Msh4       TEXT NOT NULL DEFAULT '',
    hl7Msh5       TEXT NOT NULL DEFAULT 'ZLZ',
    hl7Msh6       TEXT NOT NULL DEFAULT 'LAB',
    createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ReservedOrderNumber (
    id                      TEXT NOT NULL PRIMARY KEY,
    number                  TEXT NOT NULL UNIQUE,
    serviceType             TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'available',
    usedAt                  DATETIME,
    usedForPatientId        TEXT,
    usedForServiceRequestId TEXT,
    createdAt               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reserved_status_type
    ON ReservedOrderNumber (status, serviceType);

CREATE TABLE IF NOT EXISTS PoolNotificationLog (
    id             TEXT NOT NULL PRIMARY KEY,
    level          TEXT NOT NULL,
    sentAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remainingCount INTEGER NOT NULL,
    poolRefilled   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS PoolThresholdConfig (
    id                TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    infoAt            INTEGER NOT NULL DEFAULT 30,
    warnAt            INTEGER NOT NULL DEFAULT 15,
    errorAt           INTEGER NOT NULL DEFAULT 5,
    notificationEmail TEXT NOT NULL DEFAULT ''
);

-- Seed default threshold row (singleton)
INSERT OR IGNORE INTO PoolThresholdConfig (id) VALUES ('default');
