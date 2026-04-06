/**
 * GET /api/health/db — database health check with full diagnosis.
 *
 * Returns a structured report of the current database state:
 *   - Connection status + latency
 *   - Provider (sqlite / postgresql / sqlserver)
 *   - Schema version (last applied migration)
 *   - Expected vs actual columns for critical tables
 *   - Actionable remediation steps when something is wrong
 *
 * Auth: admin session required (reveals schema metadata — no secrets).
 * HTTP status is always 200 — the `ok` field in the body indicates health.
 * Returns 401/403 when not authenticated as admin.
 *
 * Used by:
 *   - Admin UI DB status card
 *   - Operators diagnosing migration errors
 *   - Login route (hint in 503 responses)
 */

import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth";
import { prisma } from "@/infrastructure/db/prismaClient";
import { resolveDbConfig, maskDbUrl } from "@/infrastructure/db/DatabaseConfig";
import { classifyPrismaError } from "@/infrastructure/db/prismaError";

export const dynamic = "force-dynamic";

// ── Expected schema ───────────────────────────────────────────────────────────
// Update this list whenever a new column is added to Prisma schema.

const EXPECTED_USER_COLUMNS = [
  "id", "username", "passwordHash", "salt", "createdAt",
  "role", "status", "providerType", "externalId",
  "fhirSyncStatus", "fhirSyncedAt", "fhirSyncError",
  "fhirPractitionerId", "fhirPractitionerRoleId",
  "apiTokenHash", "apiTokenCreatedAt", "profile",
  "extraPermissions",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnCheck {
  table:   string;
  missing: string[];
  extra:   string[];
  ok:      boolean;
}

interface DbHealthResponse {
  ok:            boolean;
  status:        "healthy" | "degraded" | "unreachable";
  provider:      string;
  databaseUrl:   string;
  latencyMs:     number | null;
  connection:    "ok" | "error";
  schema:        "ok" | "outdated" | "unknown";
  columns:       ColumnCheck[];
  lastMigration: string | null;
  diagnosis:     ReturnType<typeof classifyPrismaError> | null;
  steps:         string[];
  checkedAt:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getActualColumns(table: string, provider: string): Promise<string[]> {
  try {
    if (provider === "sqlite") {
      const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
        `PRAGMA table_info("${table}")`,
      );
      return rows.map((r) => r.name);
    }
    if (provider === "postgresql") {
      const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        table,
      );
      return rows.map((r) => r.column_name);
    }
    // SQL Server / MariaDB / MySQL
    const rows = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?`,
      table,
    );
    return rows.map((r) => r.COLUMN_NAME);
  } catch {
    return [];
  }
}

async function getLastMigration(): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: string }>>(
      `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 1`,
    );
    if (rows.length === 0) return null;
    return `${rows[0]?.migration_name ?? ""} (${rows[0]?.finished_at ?? ""})`;
  } catch {
    return null;
  }
}

function buildRemediationSteps(missing: string[]): string[] {
  if (missing.length === 0) return [];
  return [
    "1. Dev-Server stoppen (Ctrl+C im Terminal)",
    "2. Prisma-Client neu generieren:  npx prisma generate",
    "3. Migration anwenden:",
    "     Dev:    npx prisma migrate dev",
    "     Prod:   npx prisma migrate deploy",
    "     SQLite (manuell): node -e \"const D=require('better-sqlite3'); const db=new D('./prisma/data/orderentry.db'); db.exec('ALTER TABLE User ADD COLUMN extraPermissions TEXT NOT NULL DEFAULT \\\"[]\\\"'); db.close();\"",
    "4. Next.js-Cache löschen:  Remove-Item -Recurse -Force .next  (PowerShell)",
    "5. Dev-Server neu starten: npm run dev",
    `Fehlende Spalten: ${missing.join(", ")}`,
  ];
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.httpStatus });
  }

  const config     = resolveDbConfig();
  const provider   = config.provider;
  const maskedUrl  = maskDbUrl(config.url);
  const checkedAt  = new Date().toISOString();

  // ── 1. Connection test ─────────────────────────────────────────────────────
  const start = Date.now();
  let latencyMs: number | null = null;
  let diagnosis: ReturnType<typeof classifyPrismaError> | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    latencyMs = Date.now() - start;
  } catch (err) {
    diagnosis = classifyPrismaError(err);
    const response: DbHealthResponse = {
      ok:            false,
      status:        "unreachable",
      provider,
      databaseUrl:   maskedUrl,
      latencyMs:     null,
      connection:    "error",
      schema:        "unknown",
      columns:       [],
      lastMigration: null,
      diagnosis,
      steps:         diagnosis.steps,
      checkedAt,
    };
    return NextResponse.json(response);
  }

  // ── 2. Column check ────────────────────────────────────────────────────────
  const actualCols  = await getActualColumns("User", provider);
  const missingCols = EXPECTED_USER_COLUMNS.filter((c) => !actualCols.includes(c));
  const extraCols   = actualCols.filter((c) => !EXPECTED_USER_COLUMNS.includes(c));

  const columnCheck: ColumnCheck = {
    table:   "User",
    missing: missingCols,
    extra:   extraCols,
    ok:      missingCols.length === 0,
  };

  // ── 3. Migration history ───────────────────────────────────────────────────
  const lastMigration = await getLastMigration();

  // ── 4. Overall result ──────────────────────────────────────────────────────
  const schemaOk  = columnCheck.ok;
  const overallOk = schemaOk;
  const steps     = buildRemediationSteps(missingCols);

  const response: DbHealthResponse = {
    ok:            overallOk,
    status:        overallOk ? "healthy" : "degraded",
    provider,
    databaseUrl:   maskedUrl,
    latencyMs,
    connection:    "ok",
    schema:        schemaOk ? "ok" : "outdated",
    columns:       [columnCheck],
    lastMigration,
    diagnosis:     null,
    steps,
    checkedAt,
  };

  return NextResponse.json(response);
}
