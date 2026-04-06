/**
 * DatabaseConfig — resolves the active database configuration.
 *
 * Priority order (highest → lowest):
 *   1. ENV variables (ORDERENTRY_DB__PROVIDER, DATABASE_URL)
 *   2. Defaults (sqlite + local file)
 *
 * DATABASE_URL is read by Prisma directly (cannot be renamed — framework constraint).
 * ORDERENTRY_DB__PROVIDER is read via EnvConfig.dbProvider (namespaced pattern).
 * This module provides the resolved values for health checks and the settings UI.
 *
 * Supported providers:
 *   sqlite      → file:./data/orderentry.db   (default, no extra service needed)
 *   postgresql  → postgresql://user:pwd@host:5432/db
 *   sqlserver   → sqlserver://host:1433;database=db;user=u;password=p;trustServerCertificate=true
 */

import { EnvConfig } from "../config/EnvConfig";

export type DbProvider = "sqlite" | "postgresql" | "sqlserver";

export interface ResolvedDbConfig {
  readonly provider: DbProvider;
  readonly url: string;
  readonly isDefault: boolean;
}

const DEFAULTS = {
  provider: "sqlite" as DbProvider,
  url:      "file:./data/orderentry.db",
} as const;

function resolveProvider(raw: string | undefined): DbProvider {
  if (raw === "postgresql" || raw === "sqlserver") return raw;
  return DEFAULTS.provider;
}

export function resolveDbConfig(): ResolvedDbConfig {
  const provider = resolveProvider(EnvConfig.dbProvider);
  const url      = process.env.DATABASE_URL?.trim() || DEFAULTS.url;
  const isDefault =
    provider === DEFAULTS.provider && url === DEFAULTS.url;

  return { provider, url, isDefault };
}

/** Returns the URL with password masked — safe for logs and UI. */
export function maskDbUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    // sqlite "file:..." is not a standard URL — return as-is
    return url;
  }
}
