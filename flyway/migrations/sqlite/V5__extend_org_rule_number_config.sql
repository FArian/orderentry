-- V5: Extend OrgRule with per-organisation order number configuration and service type mapping.
--     Extend ReservedOrderNumber with optional org-scoping (NULL = shared pool for all orgs).

-- ── OrgRule extensions ────────────────────────────────────────────────────────
ALTER TABLE OrgRule ADD COLUMN mibiPrefix        TEXT NOT NULL DEFAULT '';
ALTER TABLE OrgRule ADD COLUMN mibiStart         TEXT NOT NULL DEFAULT '';
ALTER TABLE OrgRule ADD COLUMN mibiLength        INTEGER;
ALTER TABLE OrgRule ADD COLUMN pocPrefix         TEXT NOT NULL DEFAULT '';
ALTER TABLE OrgRule ADD COLUMN pocLength         INTEGER;
ALTER TABLE OrgRule ADD COLUMN routineLength     INTEGER;
-- JSON object mapping external department codes to ServiceType ("MIBI"|"ROUTINE"|"POC")
-- Example: {"MIKRO":"MIBI","CARDIO":"ROUTINE","BGA":"POC"}
ALTER TABLE OrgRule ADD COLUMN serviceTypeMapping TEXT NOT NULL DEFAULT '{}';

-- ── ReservedOrderNumber: org-scoping ─────────────────────────────────────────
-- NULL  = shared pool (available to any organisation)
-- value = org-specific pool (only assigned to that FHIR Organisation)
ALTER TABLE ReservedOrderNumber ADD COLUMN orgFhirId TEXT;

-- Index for efficient org-specific pool lookups
CREATE INDEX IF NOT EXISTS idx_reserved_org_status_type
    ON ReservedOrderNumber (orgFhirId, status, serviceType);
