"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useRefresh, REFRESH_INTERVALS, type RefreshInterval } from "@/lib/refresh";

export default function AppHeader({ version }: { version: string }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const { t, locale, setLocale, availableLocales } = useTranslation();
  const { refresh, autoRefreshInterval, setAutoRefreshInterval } = useRefresh();

  async function refreshAuth() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setAuthed(!!data?.authenticated);
    } catch {
      setAuthed(false);
    }
  }

  useEffect(() => {
    refreshAuth();
  }, [pathname]);

  return (
    <header
      className="w-full border-b bg-zt-topbar-bg border-zt-topbar-border"
      style={{ boxShadow: "var(--zt-shadow-sm)" }}
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-4 flex items-center justify-between gap-2"
           style={{ height: "var(--zt-topbar-height)" }}>

        {/* Left: logo + brand + refresh controls */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo + wordmark */}
          <Link href="/" aria-label="Startseite" className="flex items-center gap-2 shrink-0">
            <Image
              src="/logo.svg"
              alt="ZetLab logo"
              width={28}
              height={28}
              className="h-7 w-auto select-none"
            />
            <span className="hidden sm:inline font-semibold text-zt-text-primary text-sm tracking-tight">
              ZetLab
            </span>
          </Link>

          {/* Divider */}
          <span className="hidden sm:block h-5 w-px bg-zt-border shrink-0" aria-hidden="true" />

          {/* Version */}
          <span className="hidden md:inline text-xs text-zt-text-tertiary whitespace-nowrap shrink-0">
            {t("nav.version")} {version}
          </span>

          {/* Refresh controls */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <button
              onClick={refresh}
              title={t("nav.refresh")}
              className="rounded border border-zt-border bg-zt-bg-card px-1.5 py-0.5 text-xs text-zt-text-secondary hover:bg-zt-bg-muted hover:text-zt-primary transition-colors"
              aria-label={t("nav.refresh")}
            >
              ↻
            </button>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value) as RefreshInterval)}
              className={`rounded border px-1.5 py-0.5 text-xs transition-colors ${
                autoRefreshInterval > 0
                  ? "border-zt-primary-border bg-zt-primary-light text-zt-primary font-medium"
                  : "border-zt-border bg-zt-bg-card text-zt-text-secondary"
              }`}
              title={t("nav.autoRefresh")}
            >
              {REFRESH_INTERVALS.map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? t("nav.autoRefreshOff") : `${s}s`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: locale + settings + auth */}
        <div className="flex items-center gap-1.5 sm:gap-3 text-sm min-h-[1rem]">
          {/* Locale switcher */}
          <div className="flex rounded overflow-hidden border border-zt-border text-xs shrink-0">
            {availableLocales.map((loc) => (
              <button
                key={loc}
                onClick={() => setLocale(loc)}
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

          {/* Settings */}
          <Link
            href="/settings"
            className="hidden sm:inline text-zt-text-secondary hover:text-zt-primary hover:underline"
          >
            {t("nav.settings")}
          </Link>
          <Link
            href="/settings"
            className="sm:hidden text-zt-text-tertiary hover:text-zt-primary text-base leading-none"
            title={t("nav.settings")}
            aria-label={t("nav.settings")}
          >
            &#9881;
          </Link>

          {authed === null ? null : authed ? (
            <>
              <Link
                href="/profile"
                className="hidden sm:inline text-zt-text-secondary hover:text-zt-primary hover:underline"
              >
                {t("nav.profile")}
              </Link>
              <Link
                href="/profile"
                className="sm:hidden text-zt-text-tertiary hover:text-zt-primary text-base leading-none"
                title={t("nav.profile")}
                aria-label={t("nav.profile")}
              >
                👤
              </Link>
              <form action="/api/logout" method="post">
                <button
                  className="text-zt-primary hover:underline text-sm"
                  type="submit"
                >
                  {t("nav.logout")}
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="text-zt-primary hover:underline">
              {t("nav.login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
