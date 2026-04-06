#!/usr/bin/env node
/**
 * scripts/run-migrations.mjs
 *
 * CLI wrapper for the SQLite migration runner.
 * Run via: npm run db:migrate:sqlite
 *
 * Reads DB_PROVIDER and DATABASE_URL from .env.local / process.env.
 * For PostgreSQL/MSSQL use: npm run db:migrate:pg (Flyway Docker service).
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load .env.local if present
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

const provider = (process.env.DB_PROVIDER ?? "sqlite").toLowerCase();

if (provider !== "sqlite") {
  console.log(`[db] DB_PROVIDER=${provider} — use 'npm run db:migrate:pg' (Flyway Docker service).`);
  process.exit(0);
}

// Run via tsx (handles TypeScript + path aliases)
const tsxEntry = resolve(root, "src/infrastructure/db/run-migrations-cli.ts");
const result = spawnSync("npx", ["tsx", tsxEntry], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});

process.exit(result.status ?? 1);
