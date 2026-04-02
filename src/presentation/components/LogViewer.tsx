"use client";

/**
 * LogViewer — reads from GET /api/logs and displays structured log entries.
 *
 * Features:
 *  - Level filter (minimum log level)
 *  - Full-text search (msg + ctx)
 *  - Auto-refresh with configurable interval
 *  - Manual refresh button
 *  - Colour-coded level badges
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "@/lib/i18n";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LogEntry {
  time:    string;
  level:   string;
  ctx:     string;
  msg:     string;
  traceId?: string;
  [key: string]: unknown;
}

interface LogsResponse {
  enabled:  boolean;
  logFile:  string | null;
  total:    number;
  entries:  LogEntry[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  debug: "bg-gray-100 text-gray-600",
  info:  "bg-blue-100 text-blue-700",
  warn:  "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
};

const AUTO_REFRESH_OPTIONS = [0, 5, 10, 30, 60] as const;

// ── Component ──────────────────────────────────────────────────────────────────

export function LogViewer() {
  const { t } = useTranslation();

  const [data,         setData]         = useState<LogsResponse | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(false);
  const [levelFilter,  setLevelFilter]  = useState("");
  const [search,       setSearch]       = useState("");
  const [autoRefresh,  setAutoRefresh]  = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ tail: "200" });
      if (levelFilter) params.set("level",  levelFilter);
      if (search)      params.set("search", search);

      const res = await fetch(`/api/logs?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as LogsResponse;
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [levelFilter, search]);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Auto-refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh > 0) {
      intervalRef.current = setInterval(load, autoRefresh * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, load]);

  // ── Render: not enabled ──────────────────────────────────────────────────────

  if (data && !data.enabled) {
    return (
      <p className="text-sm text-gray-400 italic">{t("settings.logViewerDisabled")}</p>
    );
  }

  // ── Render: error ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <p className="text-sm text-red-500">{t("settings.logViewerError")}</p>
    );
  }

  // ── Render: controls + table ─────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <input
          type="text"
          placeholder={t("settings.logViewerSearch")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-40 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* Level filter */}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-xs bg-white"
          aria-label={t("settings.logViewerLevel")}
        >
          <option value="">{t("settings.logViewerAllLevels")}</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>

        {/* Auto-refresh */}
        <select
          value={autoRefresh}
          onChange={(e) => setAutoRefresh(Number(e.target.value))}
          className={`rounded border px-2 py-1 text-xs ${
            autoRefresh > 0
              ? "border-blue-400 bg-blue-50 text-blue-700"
              : "border-gray-300 bg-white text-gray-600"
          }`}
          aria-label={t("settings.logViewerAutoRefresh")}
        >
          {AUTO_REFRESH_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 0
                ? t("settings.logViewerAutoRefreshOff")
                : `${s}s`}
            </option>
          ))}
        </select>

        {/* Manual refresh */}
        <button
          onClick={load}
          disabled={loading}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          aria-label={t("settings.logViewerRefresh")}
        >
          {loading ? "…" : "↻"} {t("settings.logViewerRefresh")}
        </button>

        {/* Entry count */}
        {data && (
          <span className="text-xs text-gray-400 ml-auto">
            {t("settings.logViewerEntries")}: {data.total}
            {data.logFile && (
              <> &mdash; {t("settings.logViewerFile")}: <span className="font-mono">{data.logFile}</span></>
            )}
          </span>
        )}
      </div>

      {/* Table */}
      {!data || data.entries.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4 text-center">
          {loading ? t("common.loading") : t("settings.logViewerNoLogs")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-2 py-1.5 font-medium text-gray-500 whitespace-nowrap">Zeit</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-500">Level</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-500">Kontext</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-500 w-full">Meldung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.entries.map((entry, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-2 py-1 font-mono text-gray-500 whitespace-nowrap">
                    {entry.time ? new Date(entry.time).toLocaleTimeString("de-CH") : "—"}
                  </td>
                  <td className="px-2 py-1">
                    <span className={`inline-block rounded px-1.5 py-0.5 font-mono font-semibold ${LEVEL_COLORS[entry.level] ?? "bg-gray-100 text-gray-600"}`}>
                      {entry.level}
                    </span>
                  </td>
                  <td className="px-2 py-1 font-mono text-gray-600 whitespace-nowrap">
                    {entry.ctx}
                  </td>
                  <td className="px-2 py-1 text-gray-800 break-all">
                    {entry.msg}
                    {entry.traceId && (
                      <span className="ml-2 text-gray-400 font-mono text-[10px]">
                        trace:{entry.traceId}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
