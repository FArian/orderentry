/**
 * RuntimeConfig — user-controlled settings persisted to localStorage.
 *
 * These complement AppConfig (build-time NEXT_PUBLIC_* vars) and EnvConfig
 * (server-only vars). RuntimeConfig is browser-only and never reads process.env.
 *
 * Features:
 *  - Automatic backup before every write (restoreable via restoreBackup())
 *  - URL validation for configurable URL fields
 *  - SSR-safe: all calls are no-ops / return defaults when `window` is absent
 *
 * Usage:
 *   RuntimeConfig.get()                        // read current settings
 *   RuntimeConfig.set({ logLevel: "debug" })   // update (with backup) and persist
 *   RuntimeConfig.reset()                      // remove overrides, restore defaults
 *   RuntimeConfig.restoreBackup()              // undo last set()
 *   RuntimeConfig.validate({ fhirUrl: "…" })  // returns string[] of error messages
 */

import { LOCALES, isLocale, type Locale } from "@/shared/config/localesConfig";

export type ClientLogLevel = "debug" | "info" | "warn" | "error" | "silent";
/**
 * Re-export of Locale as AppLanguage for backward compatibility.
 * The authoritative list of supported languages lives in localesConfig.ts.
 */
export type AppLanguage = Locale;

export interface RuntimeSettings {
  /** Client-side log level written to the browser console. */
  logLevel: ClientLogLevel;
  /** UI language override (falls back to browser locale if not set). */
  language: AppLanguage;
  /** Debug mode: shows additional diagnostic info in the UI. */
  debugMode: boolean;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "zetlab:runtimeSettings";
const BACKUP_KEY  = "zetlab:runtimeSettings:backup";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS: Readonly<RuntimeSettings> = {
  logLevel:  "info",
  language:  "de",
  debugMode: false,
};

// ── Validators ────────────────────────────────────────────────────────────────

const VALID_LEVELS: ReadonlyArray<ClientLogLevel> = ["debug", "info", "warn", "error", "silent"];
/**
 * Derived from localesConfig.LOCALES — adding a locale there automatically
 * makes it a valid value here without touching this file.
 */
const VALID_LANGUAGES: ReadonlyArray<AppLanguage> = LOCALES;

function isClientLogLevel(v: unknown): v is ClientLogLevel {
  return VALID_LEVELS.includes(v as ClientLogLevel);
}

function isAppLanguage(v: unknown): v is AppLanguage {
  return isLocale(v);
}

/**
 * Validates a partial settings object.
 * Returns a list of human-readable error messages (empty = valid).
 */
function validate(partial: Partial<RuntimeSettings>): string[] {
  const errors: string[] = [];
  if (partial.logLevel !== undefined && !isClientLogLevel(partial.logLevel)) {
    errors.push(`Invalid logLevel: "${partial.logLevel}". Must be one of: ${VALID_LEVELS.join(", ")}.`);
  }
  if (partial.language !== undefined && !isAppLanguage(partial.language)) {
    errors.push(`Invalid language: "${partial.language}". Must be one of: ${VALID_LANGUAGES.join(", ")}.`);
  }
  return errors;
}

// ── Read / Write ──────────────────────────────────────────────────────────────

function read(): RuntimeSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<RuntimeSettings>;
    return {
      logLevel:  isClientLogLevel(parsed.logLevel)   ? parsed.logLevel  : DEFAULTS.logLevel,
      language:  isAppLanguage(parsed.language)       ? parsed.language  : DEFAULTS.language,
      debugMode: typeof parsed.debugMode === "boolean" ? parsed.debugMode : DEFAULTS.debugMode,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(settings: Partial<RuntimeSettings>): void {
  if (typeof window === "undefined") return;
  try {
    // 1. Backup current settings before overwriting
    const current = read();
    localStorage.setItem(BACKUP_KEY, JSON.stringify(current));
    // 2. Merge and persist
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
  } catch {
    // Quota exceeded or private browsing — silently ignore
  }
}

function reset(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Restores the settings snapshot saved before the last set() call.
 * Returns true if a backup was found and restored, false otherwise.
 */
function restoreBackup(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const backup = localStorage.getItem(BACKUP_KEY);
    if (!backup) return false;
    localStorage.setItem(STORAGE_KEY, backup);
    localStorage.removeItem(BACKUP_KEY);
    return true;
  } catch {
    return false;
  }
}

export const RuntimeConfig = {
  get: read,
  set: write,
  reset,
  restoreBackup,
  validate,
  VALID_LEVELS,
  VALID_LANGUAGES,
};
