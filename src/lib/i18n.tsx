"use client";

/**
 * i18n — React Context for UI translations.
 *
 * ── Single source of truth ───────────────────────────────────────────────────
 * The active locale is stored in RuntimeConfig (localStorage key
 * "zetlab:runtimeSettings"), NOT in a separate "zetlab_locale" key.
 * This eliminates the previous disconnect between the Settings page and the
 * AppHeader language switcher (Bug: two competing storage keys).
 *
 * ── Language detection priority ───────────────────────────────────────────────
 * 1. RuntimeConfig.get().language  (explicit user preference, survives refresh)
 * 2. Browser language              (navigator.languages, matched to known locales)
 * 3. DEFAULT_LOCALE ("de")         (ultimate fallback)
 *
 * ── Adding a language ────────────────────────────────────────────────────────
 * Edit ONLY src/shared/config/localesConfig.ts. This file needs no changes.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  LOCALES,
  LOCALE_MESSAGES,
  LOCALE_FALLBACKS,
  DEFAULT_LOCALE,
  detectBrowserLocale,
  isLocale,
  type Locale,
} from "@/shared/config/localesConfig";
import { RuntimeConfig } from "@/shared/config/RuntimeConfig";

// ── Key resolution ────────────────────────────────────────────────────────────

/**
 * Resolves a dot-notation key like "auth.error401" against a message object.
 * Returns the key itself (not an empty string) when nothing is found, so
 * missing translations are immediately visible in the UI.
 */
function resolve(
  messages: Record<string, unknown>,
  key: string,
): string {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === "string" ? current : key;
}

// ── Context ───────────────────────────────────────────────────────────────────

type I18nContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  availableLocales: ReadonlyArray<Locale>;
};

const I18nContext = createContext<I18nContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
  availableLocales: LOCALES,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start with DEFAULT_LOCALE on the server; correct value is applied after
  // hydration in the effect below (localStorage is client-only).
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    // Priority 1: explicit user preference in RuntimeConfig
    const stored = RuntimeConfig.get().language;
    if (isLocale(stored)) {
      setLocaleState(stored);
      return;
    }
    // Priority 2: browser language
    const browser = detectBrowserLocale();
    setLocaleState(browser);
  }, []);

  /**
   * Changes the active locale and persists it via RuntimeConfig so that:
   *  - The Settings page language dropdown stays in sync (it reads RuntimeConfig)
   *  - The AppHeader switcher stays in sync (it reads this context)
   *  - The preference survives page refresh
   */
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    RuntimeConfig.set({ language: l });
  }, []);

  const t = useCallback(
    (key: string): string => {
      const primary = LOCALE_MESSAGES[locale];
      const result = resolve(primary, key);
      if (result !== key) return result;

      // Fallback chain: try the configured fallback locale if key is missing
      const fallbackLocale = LOCALE_FALLBACKS[locale];
      if (fallbackLocale) {
        const fallbackResult = resolve(LOCALE_MESSAGES[fallbackLocale], key);
        if (fallbackResult !== key) return fallbackResult;
      }

      return key; // return the key so missing translations are visible
    },
    [locale],
  );

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, t, availableLocales: LOCALES }}
    >
      {children}
    </I18nContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTranslation() {
  return useContext(I18nContext);
}

// Re-export Locale so existing imports of `Locale` from "@/lib/i18n" keep working
export type { Locale };
