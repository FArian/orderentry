/**
 * run-migrations-cli.ts
 *
 * Entry point for: npm run db:migrate:sqlite
 * Run via tsx (handles TS + @/ path aliases via tsconfig paths).
 *
 * Do NOT import this file from application code — it is a CLI entry point only.
 */

import { runMigrations } from "./runMigrations";

runMigrations()
  .then(() => {
    console.info("[db] Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[db] Migration failed:", err);
    process.exit(1);
  });
