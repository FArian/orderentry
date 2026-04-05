-- V7: Fix data corruption introduced by V6's positional INSERT (SELECT *).
--
-- Root cause: V6 used INSERT INTO OrgRule_v6 SELECT * FROM OrgRule.
-- At the time V6 ran, the old OrgRule table (after V5) had column order:
--   ..., hl7Msh6, createdAt, updatedAt, mibiPrefix, mibiStart, ...
-- V6's new table put the order:
--   ..., hl7Msh6, mibiPrefix, mibiStart, ..., serviceTypeMapping, createdAt, updatedAt
-- The positional SELECT * shifted every V5 column by two positions, causing:
--   - mibiPrefix / mibiStart → received datetime strings
--   - mibiLength             → received the TEXT "MI" (can't cast to INTEGER)
--   - routineLength          → received "PO"
--   - serviceTypeMapping     → received the integer pocLength value
--   - createdAt / updatedAt  → received serviceTypeMapping JSON and numeric values
--
-- Recovery: delete all corrupt rows.
-- These were test entries created before V6 was available on the running server.
-- The UI (OrgRulesPage) can be used to re-enter the data correctly.

DELETE FROM OrgRule
WHERE mibiLength NOT NULL
  AND typeof(mibiLength) = 'text';
-- Rows whose mibiLength column holds TEXT (e.g. "MI") are the corrupt ones.
-- Rows created AFTER V7 will have NULL or a valid INTEGER.
