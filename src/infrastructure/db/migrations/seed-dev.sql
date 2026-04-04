-- =============================================================================
-- seed-dev.sql — Entwicklungsdaten für z2Lab OrderEntry
--
-- Fügt einen Admin- und einen Standard-Testbenutzer ein.
-- Passwörter: admin → "Admin1234!", testuser → "Test1234!"
--
-- WARNUNG: Nur für lokale Entwicklung — NIEMALS in Produktion ausführen!
--
-- SQLite:     sqlite3 data/orderentry.db < src/infrastructure/db/migrations/seed-dev.sql
-- PostgreSQL: psql -h localhost -U zetlab -d orderentry -f seed-dev.sql
-- MSSQL:      sqlcmd -S localhost -U sa -P Pass! -d orderentry -i seed-dev.sql
-- =============================================================================

-- Admin-Benutzer (Passwort: Admin1234!)
-- Hash erzeugt mit: crypto.scrypt("Admin1234!", salt, 64)
-- Zum Erzeugen eines neuen Hashes: node -e "
--   const c=require('crypto'), s=c.randomBytes(16).toString('hex');
--   c.scrypt('DEINPASSWORT',s,64,(e,k)=>console.log('salt:',s,'\nhash:',k.toString('hex')))"

INSERT INTO "User" (
    id, username, "passwordHash", salt,
    role, status, "providerType", "fhirSyncStatus"
)
SELECT
    'seed-admin-00000000-0000-0000-0000-000000000001',
    'admin',
    -- Verwende ensureBootstrapAdmin() beim ersten App-Start statt diesem Seed
    -- Dieser Eintrag ist nur ein Platzhalter für Tests ohne App-Start
    'PLACEHOLDER_HASH_use_ensureBootstrapAdmin',
    'PLACEHOLDER_SALT',
    'admin', 'active', 'local', 'not_synced'
WHERE NOT EXISTS (
    SELECT 1 FROM "User" WHERE username = 'admin'
);

-- Testbenutzer (ohne Passwort-Hash — nur für Prisma Studio / direkte DB-Tests)
INSERT INTO "User" (
    id, username, "passwordHash", salt,
    role, status, "providerType", "fhirSyncStatus", profile
)
SELECT
    'seed-test-000000-0000-0000-0000-000000000002',
    'testuser',
    'PLACEHOLDER_HASH',
    'PLACEHOLDER_SALT',
    'user', 'active', 'local', 'not_synced',
    '{"firstName":"Test","lastName":"User","email":"test@zlz.ch","orgFhirId":"zlz"}'
WHERE NOT EXISTS (
    SELECT 1 FROM "User" WHERE username = 'testuser'
);

-- Hinweis: Für echte Passwort-Hashes den App-Start nutzen (ensureBootstrapAdmin)
-- oder über POST /api/signup neue Benutzer anlegen.
