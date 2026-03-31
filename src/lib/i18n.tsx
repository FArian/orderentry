"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import it from "@/messages/it.json";

export type Locale = "de" | "en" | "fr" | "it";

const messages: Record<Locale, Record<string, unknown>> = { de, en, fr, it };

const STORAGE_KEY = "zetlab_locale";
const DEFAULT_LOCALE: Locale = "de";

const AVAILABLE_LOCALES: Locale[] = ["de", "fr", "it", "en"];

// Resolve a dot-notation key like "order.priority_routine"
function resolve(obj: Record<string, unknown>, key: string): string {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === "string" ? current : key;
}

type I18nContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  availableLocales: Locale[];
};

const I18nContext = createContext<I18nContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
  availableLocales: AVAILABLE_LOCALES,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && saved in messages) setLocaleState(saved);
    } catch {}
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const t = useCallback(
    (key: string) => resolve(messages[locale] as Record<string, unknown>, key),
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, availableLocales: AVAILABLE_LOCALES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
