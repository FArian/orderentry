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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <header className="w-full border-b bg-gray-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2 grid grid-cols-3 items-center gap-2">

        {/* Left: version + locale + refresh */}
        <div className="justify-self-start flex items-center gap-1.5 sm:gap-3 text-xs text-gray-500 min-w-0">
          {/* Version — hidden on small screens */}
          <span className="hidden md:inline whitespace-nowrap shrink-0">
            {t("nav.version")} {version}
          </span>

          {/* Locale switcher */}
          <div className="flex rounded overflow-hidden border border-gray-300 text-xs shrink-0">
            {availableLocales.map((loc) => (
              <button
                key={loc}
                onClick={() => setLocale(loc)}
                className={`px-1.5 sm:px-2 py-0.5 transition-colors ${
                  locale === loc
                    ? "bg-blue-600 text-white font-semibold"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                {loc.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Refresh controls — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <button
              onClick={refresh}
              title={t("nav.refresh")}
              className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors"
              aria-label={t("nav.refresh")}
            >
              ↻
            </button>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value) as RefreshInterval)}
              className={`rounded border px-1.5 py-0.5 text-xs transition-colors ${
                autoRefreshInterval > 0
                  ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                  : "border-gray-300 bg-white text-gray-600"
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

        {/* Center: logo */}
        <div className="justify-self-center">
          <Link href="/" aria-label="Startseite">
            <Image
              src="/logo.svg"
              alt="zetLab logo"
              width={32}
              height={32}
              className="h-8 w-auto select-none"
            />
          </Link>
        </div>

        {/* Right: auth links */}
        <div className="justify-self-end text-sm min-h-[1rem] flex items-center gap-2 sm:gap-4">
          {authed === null ? null : authed ? (
            <>
              {/* Profile: text on sm+, icon on mobile */}
              <Link
                href="/profile"
                className="hidden sm:inline text-gray-600 hover:text-blue-600 hover:underline"
              >
                {t("nav.profile")}
              </Link>
              <Link
                href="/profile"
                className="sm:hidden text-gray-500 hover:text-blue-600 text-base leading-none"
                title={t("nav.profile")}
                aria-label={t("nav.profile")}
              >
                👤
              </Link>
              <form action="/api/logout" method="post">
                <button
                  className="text-blue-600 hover:underline text-sm"
                  type="submit"
                >
                  {t("nav.logout")}
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="text-blue-600 hover:underline">
              {t("nav.login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
