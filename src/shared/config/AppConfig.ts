/**
 * Client-safe application configuration.
 *
 * Only NEXT_PUBLIC_ variables are included here — these are the only ones
 * that Next.js exposes to the browser bundle.
 *
 * Rules:
 *  - Never put secrets or server-only vars here.
 *  - Import this file anywhere (server or client components).
 *  - Use EnvConfig for server-only settings.
 */

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

export const AppConfig = {
  // ── App metadata ──────────────────────────────────────────────────────────
  /** Injected at build time by scripts/write-version.mjs via .env.local. */
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",

  // ── Feature flags ─────────────────────────────────────────────────────────
  /** Use browser-only auth (no server session store). Useful for read-only FS. */
  forceLocalAuth: bool(process.env.NEXT_PUBLIC_FORCE_LOCAL_AUTH),

  /** Show SASIS insurance-lookup UI. */
  sasísEnabled: bool(process.env.NEXT_PUBLIC_SASIS_ENABLED),

  /** Show GLN lookup UI. */
  glnEnabled: bool(process.env.NEXT_PUBLIC_GLN_ENABLED),

  // ── Defaults ──────────────────────────────────────────────────────────────
  /** Default pagination size used across all list pages. */
  defaultPageSize: 20,

  /** Debounce delay (ms) for search inputs. */
  searchDebounceMs: 350,
} as const;

export type AppConfigType = typeof AppConfig;
