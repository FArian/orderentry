"use client";

/**
 * /admin/logs — Structured log viewer (Admin only).
 *
 * Reads from GET /api/logs. Requires LOG_FILE to be configured on the server.
 * Default filter: error (SEVERE). All levels selectable.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { useTranslation } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { formatDate } from "@/shared/utils/formatDate";

// ── Types ─────────────────────────────────────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error" | "";

interface LogEntry {
  time: string;
  level: string;
  ctx: string;
  msg: string;
  [key: string]: unknown;
}

interface LogsResponse {
  enabled: boolean;
  logFile: string | null;
  total: number;
  entries: LogEntry[];
}

// ── Level helpers ─────────────────────────────────────────────────────────────

const LEVELS: { value: LogLevel; labelKey: string }[] = [
  { value: "",      labelKey: "logs.levelAll"   },
  { value: "debug", labelKey: "logs.levelDebug" },
  { value: "info",  labelKey: "logs.levelInfo"  },
  { value: "warn",  labelKey: "logs.levelWarn"  },
  { value: "error", labelKey: "logs.levelError" },
];

function levelClass(level: string): string {
  switch (level) {
    case "error": return "text-zt-danger font-semibold";
    case "warn":  return "text-zt-warning-text font-medium";
    case "info":  return "text-zt-info";
    case "debug": return "text-zt-text-tertiary";
    default:      return "text-zt-text-secondary";
  }
}

function levelBg(level: string): string {
  switch (level) {
    case "error": return "bg-zt-danger-light border-l-2 border-zt-danger";
    case "warn":  return "bg-zt-warning-bg border-l-2 border-zt-warning-border";
    default:      return "";
  }
}

function levelLabel(level: string): string {
  return level.toUpperCase().padEnd(5);
}

// ── Meta extras (fields beyond time/level/ctx/msg) ───────────────────────────

function extraMeta(entry: LogEntry): string {
  const skip = new Set(["time", "level", "ctx", "msg"]);
  const pairs = Object.entries(entry)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`);
  return pairs.join("  ");
}

// ── formatTime: ISO → hh:mm:ss.mmm (date via formatDate) ─────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${formatDate(iso)} ${hh}:${mm}:${ss}.${ms}`;
  } catch {
    return iso;
  }
}

// ── LogRow ────────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const extra = extraMeta(entry);

  return (
    <div
      className={`font-mono text-[11.5px] px-3 py-1.5 border-b border-zt-border cursor-pointer hover:bg-zt-bg-muted transition-colors ${levelBg(entry.level)}`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-3 min-w-0">
        {/* Time */}
        <span className="shrink-0 text-zt-text-tertiary w-[180px]">
          {formatTime(entry.time)}
        </span>
        {/* Level badge */}
        <span className={`shrink-0 w-[42px] ${levelClass(entry.level)}`}>
          {levelLabel(entry.level)}
        </span>
        {/* Context */}
        <span className="shrink-0 w-[160px] text-zt-text-secondary truncate" title={entry.ctx}>
          {entry.ctx}
        </span>
        {/* Message */}
        <span className="flex-1 text-zt-text-primary break-all">
          {entry.msg}
        </span>
      </div>
      {/* Extra meta — shown when expanded or when present on error */}
      {extra && (expanded || entry.level === "error") && (
        <div className="mt-1 ml-[225px] text-zt-text-tertiary break-all whitespace-pre-wrap">
          {extra}
        </div>
      )}
    </div>
  );
}

// ── LogsPage ──────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const { t } = useTranslation();
  const { isAdmin, status } = useSession();

  const [level,    setLevel]    = useState<LogLevel>("error");
  const [search,   setSearch]   = useState("");
  const [tail,     setTail]     = useState(200);
  const [autoRef,  setAutoRef]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [data,     setData]     = useState<LogsResponse | null>(null);
  const [fetchErr, setFetchErr] = useState("");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setFetchErr("");
    try {
      const params = new URLSearchParams({ tail: String(tail) });
      if (level)  params.set("level",  level);
      if (search) params.set("search", search);
      const res = await fetch(`/api/logs?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        setFetchErr(err.detail ?? `HTTP ${res.status}`);
        return;
      }
      setData(await res.json() as LogsResponse);
    } catch (e: unknown) {
      setFetchErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [level, search, tail]);

  // Initial load + re-fetch when filters change
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-refresh every 10 s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRef) {
      intervalRef.current = setInterval(() => { fetchLogs(); }, 10_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRef, fetchLogs]);

  // ── Not admin ────────────────────────────────────────────────────────────────
  if (status !== "loading" && !isAdmin) {
    return (
      <div className="flex min-h-screen bg-zt-bg-page">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-zt-text-secondary">{t("common.accessDenied")}</p>
        </main>
      </div>
    );
  }

  const entries = data?.entries ?? [];

  return (
    <div className="flex min-h-screen bg-zt-bg-page">
      <AppSidebar />

      <main className="flex-1 flex flex-col min-w-0 p-6 gap-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="mb-2">
              <BackButton />
            </div>
            <h1 className="text-xl font-semibold text-zt-text-primary">{t("logs.title")}</h1>
            {data?.logFile && (
              <p className="text-[12px] text-zt-text-tertiary mt-0.5">
                {t("logs.file")}: <span className="font-mono">{data.logFile}</span>
              </p>
            )}
          </div>

          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-[13px] text-zt-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRef}
              onChange={(e) => setAutoRef(e.target.checked)}
              className="w-4 h-4 accent-zt-primary"
            />
            {t("logs.autoRefresh")}
          </label>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap bg-zt-bg-card border border-zt-border rounded-lg px-4 py-3">

          {/* Level selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-zt-text-secondary shrink-0">{t("logs.filterLevel")}:</span>
            <div className="flex gap-1">
              {LEVELS.map(({ value, labelKey }) => (
                <button
                  key={value}
                  onClick={() => setLevel(value)}
                  className={`px-2.5 py-1 text-[11px] rounded font-medium transition-colors ${
                    level === value
                      ? "bg-zt-primary text-zt-text-on-primary"
                      : "bg-zt-bg-page text-zt-text-secondary border border-zt-border hover:border-zt-border-strong"
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="h-5 border-l border-zt-border hidden sm:block" />

          {/* Search */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("logs.searchPlaceholder")}
            className="flex-1 min-w-[160px] px-3 py-1.5 text-[13px] bg-zt-bg-page border border-zt-border rounded focus:outline-none focus:border-zt-primary text-zt-text-primary placeholder:text-zt-text-tertiary"
          />

          {/* Tail selector */}
          <select
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
            className="px-2.5 py-1.5 text-[13px] bg-zt-bg-page border border-zt-border rounded focus:outline-none focus:border-zt-primary text-zt-text-primary"
          >
            {[100, 200, 500, 1000].map((n) => (
              <option key={n} value={n}>{t("logs.lastN").replace("{n}", String(n))}</option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3 py-1.5 text-[13px] font-medium bg-zt-primary text-zt-text-on-primary rounded hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
          >
            {loading ? t("logs.refreshing") : t("logs.refresh")}
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-[12px] text-zt-text-tertiary">
          <span>
            {t("logs.showing")} <strong className="text-zt-text-primary">{entries.length}</strong> {t("logs.entries")}
          </span>
          {autoRef && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zt-success animate-pulse inline-block" />
              {t("logs.autoRefreshActive")}
            </span>
          )}
        </div>

        {/* Error */}
        {fetchErr && (
          <div className="px-4 py-3 bg-zt-danger-light border border-zt-danger-border rounded-lg text-[13px] text-zt-danger">
            {fetchErr}
          </div>
        )}

        {/* Log file not configured */}
        {!loading && data && !data.enabled && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
            <p className="text-[14px] font-medium text-zt-text-primary">{t("logs.notConfiguredTitle")}</p>
            <p className="text-[13px] text-zt-text-secondary max-w-md">{t("logs.notConfiguredDesc")}</p>
            <code className="text-[12px] bg-zt-bg-muted border border-zt-border rounded px-3 py-1.5 font-mono text-zt-text-secondary">
              LOG_FILE=/app/logs/zetlab.log
            </code>
          </div>
        )}

        {/* Log table */}
        {data?.enabled && (
          <div className="flex-1 bg-zt-bg-card border border-zt-border rounded-lg overflow-hidden flex flex-col min-h-0">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-3 py-2 bg-zt-bg-muted border-b border-zt-border text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide">
              <span className="w-[180px] shrink-0">{t("logs.colTime")}</span>
              <span className="w-[42px] shrink-0">{t("logs.colLevel")}</span>
              <span className="w-[160px] shrink-0">{t("logs.colContext")}</span>
              <span className="flex-1">{t("logs.colMessage")}</span>
            </div>

            {/* Entries */}
            <div className="flex-1 overflow-y-auto">
              {loading && entries.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-zt-text-tertiary">
                  {t("common.loading")}
                </div>
              )}
              {!loading && entries.length === 0 && data.enabled && (
                <div className="px-4 py-8 text-center text-[13px] text-zt-text-tertiary">
                  {t("logs.noEntries")}
                </div>
              )}
              {entries.map((entry, i) => (
                <LogRow key={`${entry.time}-${i}`} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
