/**
 * SqliteMigrationRunner — Flyway-compatible migration runner for SQLite.
 *
 * Reads V*.sql files from flyway/migrations/sqlite/ in version order and
 * applies any that have not yet been recorded in the flyway_schema_history table.
 *
 * This mimics Flyway's behaviour exactly so the same SQL files work with both:
 *   - This runner (SQLite, local dev / Docker default)
 *   - Official Flyway Docker image (PostgreSQL, MSSQL in production)
 *
 * flyway_schema_history columns match Flyway's schema so the table is
 * compatible if you ever attach Flyway to the SQLite DB directly.
 *
 * Never import this in client-side code — it is Node.js-only.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "flyway/migrations/sqlite");

function ensureHistoryTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS flyway_schema_history (
      installed_rank INTEGER NOT NULL PRIMARY KEY,
      version        TEXT,
      description    TEXT    NOT NULL,
      type           TEXT    NOT NULL DEFAULT 'SQL',
      script         TEXT    NOT NULL,
      checksum       INTEGER,
      installed_by   TEXT    NOT NULL DEFAULT 'zetlab',
      installed_on   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      execution_time INTEGER NOT NULL DEFAULT 0,
      success        INTEGER NOT NULL DEFAULT 1
    );
  `);
}

function checksumOf(content: string): number {
  // CRC32 is not in Node crypto — use MD5 truncated to int32 (same purpose: detect file changes)
  const buf = crypto.createHash("md5").update(content).digest();
  return buf.readInt32BE(0);
}

function parseVersion(filename: string): number {
  const match = filename.match(/^V(\d+(?:_\d+)?)__/);
  if (!match) return -1;
  return parseFloat(match[1]!.replace("_", "."));
}

function appliedVersions(db: Database.Database): Set<string> {
  const rows = db
    .prepare("SELECT version FROM flyway_schema_history WHERE success = 1")
    .all() as { version: string }[];
  return new Set(rows.map((r) => r.version));
}

export function runSqliteMigrations(dbUrl: string): void {
  // Resolve the SQLite path the same way Prisma does:
  // relative paths are resolved from the `prisma/` directory (where schema.prisma lives),
  // not from process.cwd(). This keeps the migration runner and Prisma pointing at the same file.
  const PRISMA_SCHEMA_DIR = path.resolve(process.cwd(), "prisma");
  const rawPath = dbUrl.replace(/^file:/, "");
  const dbPath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(PRISMA_SCHEMA_DIR, rawPath);

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  ensureHistoryTable(db);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.warn(`[db] Migration directory not found: ${MIGRATIONS_DIR}`);
    db.close();
    return;
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^V\d+.*\.sql$/i.test(f))
    .sort((a, b) => parseVersion(a) - parseVersion(b));

  const applied  = appliedVersions(db);
  let rank       = (db.prepare("SELECT MAX(installed_rank) AS r FROM flyway_schema_history").get() as { r: number | null }).r ?? 0;

  for (const file of files) {
    const versionMatch = file.match(/^V(\d+(?:_\d+)?)__/);
    if (!versionMatch) continue;
    const version = versionMatch[1]!;

    if (applied.has(version)) continue;

    const sql      = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const checksum = checksumOf(sql);
    const start    = Date.now();

    console.info(`[db] Applying migration ${file}…`);
    db.exec(sql);
    rank++;

    db.prepare(`
      INSERT INTO flyway_schema_history
        (installed_rank, version, description, script, checksum, execution_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      rank,
      version,
      file.replace(/^V\d+(?:_\d+)?__/, "").replace(/_/g, " ").replace(/\.sql$/i, ""),
      file,
      checksum,
      Date.now() - start,
    );

    console.info(`[db] Migration ${file} applied in ${Date.now() - start}ms`);
  }

  db.close();
  console.info("[db] SQLite migrations complete.");
}
