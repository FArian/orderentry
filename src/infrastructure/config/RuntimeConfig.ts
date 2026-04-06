/**
 * RuntimeConfig — runtime configuration override layer.
 *
 * Priority (highest → lowest):
 *   1. Environment   (process.env)  ← always wins; cannot be overridden at runtime
 *   2. GUI override  (data/config.json)
 *   3. Default value (hardcoded fallback)
 *
 * Overrides are stored in data/config.json and take effect immediately
 * on the next request — no application restart required.
 * If a process.env variable is set, the config.json override is ignored for that key.
 *
 * Vercel: data/config.json does not persist between invocations.
 *   GET  → returns env / default values (overrides are always empty).
 *   POST → returns 405 (guarded in ConfigController).
 *
 * Docker / local dev: data/config.json is writable and persistent.
 */

import fs from "node:fs/promises";
import path from "node:path";

// ── Supported keys ────────────────────────────────────────────────────────────

export const SUPPORTED_KEYS = [
  "FHIR_BASE_URL",
  "LOG_LEVEL",
  "LOG_FILE",
  "TRACING_ENDPOINT",
  "METRICS_DASHBOARD_URL",
] as const;

export type SupportedKey = (typeof SUPPORTED_KEYS)[number];

/** Hardcoded fallback values — used when neither override nor env var is set. */
export const DEFAULTS: Record<SupportedKey, string> = {
  FHIR_BASE_URL: "http://localhost:8080/fhir",
  LOG_LEVEL: "info",
  LOG_FILE: "",
  TRACING_ENDPOINT: "",
  METRICS_DASHBOARD_URL: "",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConfigOverrides = Partial<Record<SupportedKey, string>>;

// ── File path ─────────────────────────────────────────────────────────────────

function configFilePath(cwd: string): string {
  return path.join(cwd, "data", "config.json");
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Reads config.json and returns the stored overrides.
 * Returns an empty object if the file does not exist or cannot be parsed.
 */
export async function readOverrides(cwd = process.cwd()): Promise<ConfigOverrides> {
  try {
    const raw = await fs.readFile(configFilePath(cwd), "utf-8");
    return JSON.parse(raw) as ConfigOverrides;
  } catch {
    return {};
  }
}

// ── Resolve ───────────────────────────────────────────────────────────────────

/**
 * Resolves a single key using the priority chain:
 *   process.env → override → default
 *
 * ENV always wins. config.json override is only used when no ENV var is set.
 */
export function resolveKey(key: SupportedKey, overrides: ConfigOverrides): string {
  return process.env[key] ?? overrides[key] ?? DEFAULTS[key];
}

/**
 * Returns all resolved values and the raw overrides for display.
 */
export async function getAll(cwd = process.cwd()): Promise<{
  resolved: Record<SupportedKey, string>;
  overrides: ConfigOverrides;
}> {
  const overrides = await readOverrides(cwd);
  const resolved = {} as Record<SupportedKey, string>;
  for (const key of SUPPORTED_KEYS) {
    resolved[key] = resolveKey(key, overrides);
  }
  return { resolved, overrides };
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Merges updates into config.json.
 *   - string value → sets the override
 *   - null / empty string → removes the override (falls back to env/default)
 */
export async function saveOverrides(
  updates: Partial<Record<SupportedKey, string | null>>,
  cwd = process.cwd(),
): Promise<void> {
  const existing = await readOverrides(cwd);
  const next: ConfigOverrides = { ...existing };

  for (const key of SUPPORTED_KEYS) {
    if (!(key in updates)) continue;
    const val = updates[key];
    if (val === null || val === undefined || val.trim() === "") {
      delete next[key];
    } else {
      next[key] = val.trim();
    }
  }

  const filePath = configFilePath(cwd);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf-8");
}
