"use client";

import { useRefresh, REFRESH_INTERVALS, type RefreshInterval } from "@/lib/refresh";
import { useTranslation } from "@/lib/i18n";

export function AppHeaderRefreshControl() {
  const { refresh, autoRefreshInterval, setAutoRefreshInterval } = useRefresh();
  const { t } = useTranslation();
  const active = autoRefreshInterval > 0;

  return (
    <div className="hidden sm:flex items-center gap-1 shrink-0">
      <button
        onClick={refresh}
        aria-label={t("nav.refresh")}
        title={t("nav.refresh")}
        className="flex items-center justify-center w-7 h-7 rounded border border-zt-border bg-zt-bg-card text-zt-text-secondary hover:bg-zt-bg-muted hover:text-zt-primary transition-colors text-base leading-none"
      >
        ↻
      </button>
      <select
        value={autoRefreshInterval}
        onChange={(e) => setAutoRefreshInterval(Number(e.target.value) as RefreshInterval)}
        aria-label={t("nav.autoRefresh")}
        title={t("nav.autoRefresh")}
        className={`rounded border px-1.5 py-0.5 text-xs transition-colors ${
          active
            ? "border-zt-primary-border bg-zt-primary-light text-zt-primary font-medium"
            : "border-zt-border bg-zt-bg-card text-zt-text-secondary"
        }`}
      >
        {REFRESH_INTERVALS.map((s) => (
          <option key={s} value={s}>
            {s === 0 ? t("nav.autoRefreshOff") : `${s}s`}
          </option>
        ))}
      </select>
    </div>
  );
}
