#!/usr/bin/env node
/**
 * scripts/check-db.mjs
 * Quick DB health check — queries every table and reports row counts.
 * Run: node scripts/check-db.mjs
 */

import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "..");
const require   = createRequire(import.meta.url);

// Load .env.local
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

// Resolve DB path (same logic as SqliteMigrationRunner — relative to prisma/)
const dbUrl  = process.env.DATABASE_URL ?? "file:./data/orderentry.db";
const rawPath = dbUrl.replace(/^file:/, "");
const dbPath = rawPath.startsWith("/") || /^[A-Za-z]:/.test(rawPath)
  ? rawPath
  : resolve(root, "prisma", rawPath);

console.log(`\n[check-db] DB: ${dbPath}\n`);

const Database = require("better-sqlite3");
const db = new Database(dbPath, { readonly: true });

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();

let allOk = true;

for (const { name } of tables) {
  try {
    const row = db.prepare(`SELECT COUNT(*) as count FROM "${name}"`).get();
    console.log(`  ✓  ${name.padEnd(30)} ${row.count} rows`);
  } catch (err) {
    console.log(`  ✗  ${name.padEnd(30)} ERROR: ${err.message}`);
    allOk = false;
  }
}

db.close();
console.log(allOk ? "\n[check-db] All tables OK.\n" : "\n[check-db] Some tables have errors!\n");
