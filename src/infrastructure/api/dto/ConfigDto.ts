/**
 * Data Transfer Objects for the /api/config endpoint.
 *
 * Each entry exposes all three layers of the priority chain so the UI
 * can show which layer is currently active for each variable.
 */

/**
 * Which priority layer is currently providing the resolved value.
 *
 * - "locked"   — process.env is set; config.json override is ignored (ENV wins)
 * - "override" — config.json override is active (no ENV var set)
 * - "env"      — (unused, kept for compatibility) alias for "locked"
 * - "default"  — no ENV and no override; hardcoded fallback is used
 */
export type ConfigSource = "locked" | "override" | "env" | "default";

/** A single config entry as returned by GET /api/config. */
export interface ConfigEntryDto {
  /** Variable name (e.g. "FHIR_BASE_URL"). */
  key: string;
  /** Final resolved value (override ?? env ?? default). */
  value: string;
  /** Value stored in config.json, or null if no override is set. */
  override: string | null;
  /** Value from process.env, or null if not set. */
  envValue: string | null;
  /** Hardcoded fallback used when neither override nor env is present. */
  defaultValue: string;
  /** Which layer is currently active. */
  source: ConfigSource;
}

/** Response body for GET /api/config */
export interface GetConfigResponseDto {
  entries: ConfigEntryDto[];
}

/** Request body for POST /api/config */
export interface UpdateConfigRequestDto {
  /**
   * Map of key → value to override.
   * Set a key to null to remove its override (falls back to env / default).
   */
  overrides: Partial<Record<string, string | null>>;
}

/** Response body for POST /api/config */
export interface UpdateConfigResponseDto {
  ok: boolean;
  /** Human-readable message (success or error description). */
  message: string;
  /** Internal: HTTP status code used by the route; stripped from JSON body. */
  httpStatus?: number;
}
