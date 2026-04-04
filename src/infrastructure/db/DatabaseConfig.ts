/**
 * DatabaseConfig — resolves the active database configuration.
 *
 * Priority order (highest → lowest):
 *   1. ENV variables (DB_PROVIDER, DATABASE_URL)
 *   2. Defaults (sqlite + local file)
 *
 * The Prisma client reads DATABASE_URL and DB_PROVIDER directly from process.env
 * (set via `env()` in schema.prisma). This module provides the resolved values
 * for health checks, settings UI display, and startup validation.
 *
 * Supported providers:
 *   sqlite      → file:./data/orderentry.db   (default, no extra service needed)
 *   postgresql  → postgresql://user:pwd@host:5432/db
 *   sqlserver   → sqlserver://host:1433;database=db;user=u;password=p;trustServerCertificate=true
 */

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
  const provider = resolveProvider(process.env.DB_PROVIDER);
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
