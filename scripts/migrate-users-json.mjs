#!/usr/bin/env node
/**
 * scripts/migrate-users-json.mjs
 *
 * One-time migration: data/users.json → SQLite DB.
 * Uses better-sqlite3 directly — no tsx, no build step needed.
 * Safe to run multiple times (existing usernames are skipped).
 *
 * Run: node scripts/migrate-users-json.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "..");
const require   = createRequire(import.meta.url);

// ── Load .env.local ───────────────────────────────────────────────────────────
const envLocalPath = resolve(root, ".env.local");
if (existsSync(envLocalPath)) {
  for (const line of readFileSync(envLocalPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const val = raw.replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ── Resolve DB path ───────────────────────────────────────────────────────────
const dbUrl  = process.env.DATABASE_URL ?? `file:${resolve(root, "data/orderentry.db")}`;
const dbPath = dbUrl.replace(/^file:/, "");
const absDb  = dbPath.startsWith("/") || /^[A-Za-z]:/.test(dbPath)
  ? dbPath
  : resolve(root, dbPath);

// ── Check users.json ──────────────────────────────────────────────────────────
const usersJsonPath = resolve(root, "data/users.json");
if (!existsSync(usersJsonPath)) {
  console.log("[migrate] data/users.json not found — nothing to migrate.");
  process.exit(0);
}

if (!existsSync(absDb)) {
  console.error(`[migrate] SQLite DB not found at: ${absDb}`);
  console.error("[migrate] Run 'npm run db:migrate:sqlite' first to create the DB.");
  process.exit(1);
}

// ── Open DB ───────────────────────────────────────────────────────────────────
const Database = require("better-sqlite3");
const db       = new Database(absDb);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Read users.json ───────────────────────────────────────────────────────────
const { users } = JSON.parse(readFileSync(usersJsonPath, "utf8"));

const insert = db.prepare(`
  INSERT OR IGNORE INTO "User" (
    id, username, "passwordHash", salt, "createdAt",
    role, status, "providerType", "externalId",
    "fhirSyncStatus", "fhirSyncedAt", "fhirSyncError",
    "fhirPractitionerId", "fhirPractitionerRoleId",
    "apiTokenHash", "apiTokenCreatedAt", profile
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?,
    ?, ?, ?
  )
`);

let imported = 0;
let skipped  = 0;

for (const u of users) {
  const username = u.username.toLowerCase();
  const result = insert.run(
    u.id,
    username,
    u.passwordHash,
    u.salt,
    u.createdAt ?? new Date().toISOString(),
    u.role             ?? "user",
    u.status           ?? "active",
    u.providerType     ?? "local",
    u.externalId       ?? null,
    u.fhirSyncStatus   ?? "not_synced",
    u.fhirSyncedAt     ?? null,
    u.fhirSyncError    ?? null,
    u.fhirPractitionerId     ?? null,
    u.fhirPractitionerRoleId ?? null,
    u.apiTokenHash      ?? null,
    u.apiTokenCreatedAt ?? null,
    u.profile ? JSON.stringify(u.profile) : null,
  );

  if (result.changes > 0) {
    console.log(`[migrate] Imported: ${u.username} (${u.role ?? "user"})`);
    imported++;
  } else {
    console.log(`[migrate] Skipped (already exists): ${username}`);
    skipped++;
  }
}

db.close();
console.log(`\n[migrate] Done — ${imported} imported, ${skipped} skipped.`);
console.log(`[migrate] DB: ${absDb}`);
