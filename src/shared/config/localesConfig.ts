/**
 * localesConfig — single source of truth for all i18n configuration.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A NEW LANGUAGE
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Create   src/messages/<code>.json   (copy de.json, translate)
 * 2. Add one import line below           import xx from "@/messages/xx.json"
 * 3. Add one entry to LOCALES            "xx"
 * 4. Add one entry to LOCALE_LABELS      xx: "Label"
 * 5. Add one entry to LOCALE_MESSAGES    xx,
 *
 * Nothing else needs to change. Components, hooks, AppHeader, and the Settings
 * page all derive their locale lists from this file.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Layer: shared/config — no React, no Node.js APIs, no process.env.
 */

import de from "@/messages/de.json";
import deCH from "@/messages/de-CH.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import it from "@/messages/it.json";

// ── Locale registry ───────────────────────────────────────────────────────────

/**
 * All supported locale codes. The UI language-switcher derives its buttons
 * from this array — no changes needed in AppHeader or Settings when adding a locale.
 */
export const LOCALES = ["de", "de-CH", "en", "fr", "it"] as const;

export type Locale = (typeof LOCALES)[number];

/** Rendered when no stored preference exists and browser detection fails. */
export const DEFAULT_LOCALE: Locale = "de";

// ── Labels ────────────────────────────────────────────────────────────────────

/**
 * Human-readable label for each locale, shown in the Settings dropdown and
 * the AppHeader switcher.
 *
 * Add a new locale here and it automatically appears in both places.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  de: "Deutsch",
  "de-CH": "Deutsch (CH)",
  en: "English",
  fr: "Français",
  it: "Italiano",
};

// ── Fallback chain ────────────────────────────────────────────────────────────

/**
 * Optional fallback: if a key is missing in locale X, resolve() tries locale Y
 * before returning the key itself.
 *
 * Example for a future Swiss German dialect locale:
 *   "gsw-CH": "de"   ← fall back to standard German
 */
export const LOCALE_FALLBACKS: Partial<Record<Locale, Locale>> = {
  // de-CH fällt auf de zurück wenn ein Key fehlt (z.B. neu hinzugefügte Keys)
  "de-CH": "de",
};

// ── Messages ──────────────────────────────────────────────────────────────────

/**
 * Mapping from locale code to its full translation JSON.
 * This is the only place JSON files are imported.
 */
export const LOCALE_MESSAGES: Record<Locale, Record<string, unknown>> = {
  de: de as Record<string, unknown>,
  "de-CH": deCH as Record<string, unknown>,
  en: en as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
  it: it as Record<string, unknown>,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Type-guard: checks if an arbitrary string is a registered locale code. */
export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/**
 * Detects the best matching locale from the browser's language preferences.
 * Returns DEFAULT_LOCALE if no browser language matches a registered locale.
 *
 * "de-CH" → "de", "fr-FR" → "fr", "zh" → DEFAULT_LOCALE
 */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  for (const lang of navigator.languages ?? [navigator.language]) {
    // Check full code first (e.g. "de-CH"), then base language (e.g. "de")
    if (isLocale(lang)) return lang as Locale;
    const base = lang.split("-")[0];
    if (isLocale(base)) return base as Locale;
  }
  return DEFAULT_LOCALE;
}
