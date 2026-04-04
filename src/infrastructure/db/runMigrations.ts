/**
 * runMigrations — runs DB migrations at application startup.
 *
 * Routing:
 *   sqlite      → SqliteMigrationRunner (Node.js, reads flyway/migrations/sqlite/*.sql)
 *   postgresql  → No-op here; Flyway Docker service handles it before app starts
 *   sqlserver   → No-op here; Flyway Docker service handles it before app starts
 *
 * Called from instrumentation.node.ts (Next.js server startup hook) so
 * migrations run exactly once per process, before the first request.
 */

import { resolveDbConfig } from "./DatabaseConfig";

export async function runMigrations(): Promise<void> {
  const { provider, url } = resolveDbConfig();

  if (provider === "sqlite") {
    // Lazy import — keeps better-sqlite3 out of any bundle analysis
    const { runSqliteMigrations } = await import("./SqliteMigrationRunner");
    runSqliteMigrations(url);
    return;
  }

  // postgresql / sqlserver: Flyway Docker service runs before the app starts.
  // Nothing to do here — just log confirmation.
  console.info(`[db] Provider=${provider} — migrations managed by Flyway. Skipping Node.js runner.`);
}
