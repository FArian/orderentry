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

  // ── Identifier regex overrides (optional, ENV-configurable) ──────────────
  /**
   * Override default validation regex for Swiss identifiers.
   * Set these in docker-compose or .env.local to adjust format rules.
   * Values are full regex strings (without slashes), e.g. "^\\d{13}$".
   */
  regexGln:  process.env.NEXT_PUBLIC_REGEX_GLN  ?? "",
  regexAhv:  process.env.NEXT_PUBLIC_REGEX_AHV  ?? "",
  regexVeka: process.env.NEXT_PUBLIC_REGEX_VEKA ?? "",
  regexUid:  process.env.NEXT_PUBLIC_REGEX_UID  ?? "",
  regexZsr:  process.env.NEXT_PUBLIC_REGEX_ZSR  ?? "",
  regexBur:  process.env.NEXT_PUBLIC_REGEX_BUR  ?? "",

  // ── Lab context ───────────────────────────────────────────────────────────
  /**
   * FHIR Organization ID of the laboratory whose test catalog the app loads.
   * Used to filter ActivityDefinitions by useContext.
   * Set via NEXT_PUBLIC_LAB_ORG_ID env var; defaults to "zlz".
   */
  labOrgId: process.env.NEXT_PUBLIC_LAB_ORG_ID ?? "zlz",

  // ── Order service types ───────────────────────────────────────────────────
  /**
   * Comma-separated list of active order service types shown in UI dropdowns.
   * Baked into the client bundle at build time.
   * Example: NEXT_PUBLIC_ORDER_SERVICE_TYPES=MIBI,ROUTINE,POC,CHEMO
   */
  serviceTypes: (process.env.NEXT_PUBLIC_ORDER_SERVICE_TYPES ?? "MIBI,ROUTINE,POC")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

export type AppConfigType = typeof AppConfig;
