-- V6: Make OrgRule.orgGln nullable and remove its UNIQUE constraint.
--
-- Rationale: GLN is not always available when an org is first configured.
--            orgFhirId (still UNIQUE) is the primary key for org identification.
--
-- SQLite does not support ALTER COLUMN — table recreation is required.

PRAGMA foreign_keys = OFF;

CREATE TABLE OrgRule_v6 (
  id                 TEXT     NOT NULL PRIMARY KEY,
  orgFhirId          TEXT     NOT NULL UNIQUE,
  orgGln             TEXT,                           -- nullable, no UNIQUE
  orgName            TEXT     NOT NULL DEFAULT '',
  patientPrefix      TEXT     NOT NULL DEFAULT '',
  casePrefix         TEXT     NOT NULL DEFAULT '',
  hl7Msh3            TEXT     NOT NULL DEFAULT '',
  hl7Msh4            TEXT     NOT NULL DEFAULT '',
  hl7Msh5            TEXT     NOT NULL DEFAULT 'ZLZ',
  hl7Msh6            TEXT     NOT NULL DEFAULT 'LAB',
  mibiPrefix         TEXT     NOT NULL DEFAULT '',
  mibiStart          TEXT     NOT NULL DEFAULT '',
  mibiLength         INTEGER,
  pocPrefix          TEXT     NOT NULL DEFAULT '',
  pocLength          INTEGER,
  routineLength      INTEGER,
  serviceTypeMapping TEXT     NOT NULL DEFAULT '{}',
  createdAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO OrgRule_v6 SELECT * FROM OrgRule;

DROP TABLE OrgRule;
ALTER TABLE OrgRule_v6 RENAME TO OrgRule;

PRAGMA foreign_keys = ON;
