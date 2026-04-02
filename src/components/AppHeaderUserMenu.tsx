"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

const LOCALE_LABELS: Record<string, string> = {
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  en: "English",
};

type Props = {
  isAuthenticated: boolean | null;
};

export function AppHeaderUserMenu({ isAuthenticated }: Props) {
  const { t, locale, setLocale, availableLocales } = useTranslation();

  return (
    <div className="flex items-center gap-2 sm:gap-3 text-sm shrink-0">
      {/* Locale switcher */}
      <div
        role="group"
        aria-label="Sprachauswahl"
        className="flex rounded overflow-hidden border border-zt-border text-xs"
      >
        {availableLocales.map((loc) => (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            aria-label={`Sprache: ${LOCALE_LABELS[loc] ?? loc}`}
            aria-pressed={locale === loc}
            className={`px-1.5 sm:px-2 py-0.5 transition-colors ${
              locale === loc
                ? "bg-zt-primary text-zt-text-on-primary font-semibold"
                : "bg-zt-bg-card text-zt-text-secondary hover:bg-zt-bg-muted"
            }`}
          >
            {loc.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Divider */}
      <span className="hidden sm:block h-4 w-px bg-zt-border" aria-hidden="true" />

      {/* Settings — one element, text on sm+, icon on mobile */}
      <Link
        href="/settings"
        aria-label={t("nav.settings")}
        title={t("nav.settings")}
        className="text-zt-text-secondary hover:text-zt-primary transition-colors"
      >
        <span className="hidden sm:inline text-sm">{t("nav.settings")}</span>
        <span className="sm:hidden text-base leading-none" aria-hidden="true">⚙</span>
      </Link>

      {/* Auth — fixed-width slot prevents layout shift */}
      <span className="flex items-center gap-2">
        {isAuthenticated === null ? (
          <span className="w-12 h-4 rounded bg-zt-bg-muted animate-pulse" aria-hidden="true" />
        ) : isAuthenticated ? (
          <>
            <Link
              href="/profile"
              aria-label={t("nav.profile")}
              title={t("nav.profile")}
              className="text-zt-text-secondary hover:text-zt-primary transition-colors"
            >
              <span className="hidden sm:inline text-sm">{t("nav.profile")}</span>
              <span className="sm:hidden text-base leading-none" aria-hidden="true">👤</span>
            </Link>
            <form action="/api/logout" method="post">
              <button type="submit" className="text-zt-primary hover:underline text-sm">
                {t("nav.logout")}
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="text-zt-primary hover:underline text-sm">
            {t("nav.login")}
          </Link>
        )}
      </span>
    </div>
  );
}
