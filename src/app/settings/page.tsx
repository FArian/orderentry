"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { Card, Select, Button } from "@/presentation/ui";
import {
  RuntimeConfig,
  type ClientLogLevel,
  type AppLanguage,
} from "@/shared/config/RuntimeConfig";
import { LOCALE_LABELS } from "@/shared/config/localesConfig";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnvVar { key: string; value: string }

interface ServerSettings {
  logLevel:           string;
  fileLoggingEnabled: boolean;
  fhirBaseUrl:        string;
  appVersion:         string;
  enableTracing:      boolean;
  tracingUrl:         string;
  monitoringUrl:      string;
}

interface UserProfile {
  username:      string;
  firstName?:    string;
  lastName?:     string;
  organization?: string;
  email?:        string;
}

// ── Option lists ──────────────────────────────────────────────────────────────

const LOG_LEVEL_OPTIONS: Array<{ value: ClientLogLevel; label: string }> = [
  { value: "debug",  label: "Debug"  },
  { value: "info",   label: "Info"   },
  { value: "warn",   label: "Warn"   },
  { value: "error",  label: "Error"  },
  { value: "silent", label: "Silent (aus)" },
];

const LANGUAGE_OPTIONS = (
  Object.entries(LOCALE_LABELS) as Array<[AppLanguage, string]>
).map(([value, label]) => ({ value, label }));

// ── SettingsPage ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t, setLocale } = useTranslation();

  // Client settings — initialized server-safe; loaded from localStorage in useEffect
  const [clientLogLevel, setClientLogLevel] = useState<ClientLogLevel>("info");
  const [language,       setLanguage]       = useState<AppLanguage>("de");
  const [debugMode,      setDebugMode]      = useState(false);
  const [mounted,        setMounted]        = useState(false);

  // Server / user data
  const [server,  setServer]  = useState<ServerSettings | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Env editor
  const [envVars,     setEnvVars]     = useState<EnvVar[]>([]);
  const [envSaved,    setEnvSaved]    = useState(false);
  const [envError,    setEnvError]    = useState<string | null>(null);
  const [envSaving,   setEnvSaving]   = useState(false);
  const [envReadOnly, setEnvReadOnly] = useState(false);

  // Feedback
  const [saved,     setSaved]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Download state
  const [downloading, setDownloading] = useState(false);
  const [dlError,     setDlError]     = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const s = RuntimeConfig.get();
    setClientLogLevel(s.logLevel);
    setLanguage(s.language);
    setDebugMode(s.debugMode);

    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ServerSettings | null) => { if (d) setServer(d); })
      .catch(() => {});

    fetch("/api/env")
      .then((r) => {
        if (r.status === 405) { setEnvReadOnly(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((d: { vars?: EnvVar[] } | null) => { if (d?.vars) setEnvVars(d.vars); })
      .catch(() => {});

    fetch("/api/me/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { username?: string; profile?: UserProfile } | null) => {
        if (!d) return;
        const p = d.profile as Record<string, string> | undefined;
        setProfile({
          username: d.username ?? "",
          ...(p?.firstName    !== undefined && { firstName:    p.firstName }),
          ...(p?.lastName     !== undefined && { lastName:     p.lastName }),
          ...(p?.organization !== undefined && { organization: p.organization }),
          ...(p?.email        !== undefined && { email:        p.email }),
        });
      })
      .catch(() => {});
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handleSave() {
    setSaveError(null);
    const errors = RuntimeConfig.validate({ logLevel: clientLogLevel, language });
    if (errors.length > 0) { setSaveError(errors[0] ?? null); return; }
    RuntimeConfig.set({ logLevel: clientLogLevel, language, debugMode });
    setLocale(language);
    flash();
  }

  function handleReset() {
    RuntimeConfig.reset();
    const defaults = RuntimeConfig.get();
    setClientLogLevel(defaults.logLevel);
    setLanguage(defaults.language);
    setDebugMode(defaults.debugMode);
    setSaveError(null);
    flash();
  }

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // ── Env editor ────────────────────────────────────────────────────────────────

  function handleEnvChange(index: number, field: "key" | "value", val: string) {
    setEnvVars((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: val } : v)));
  }

  async function handleEnvSave() {
    setEnvError(null);
    if (envVars.find((v) => !v.key.trim())) { setEnvError(t("settings.envEditorEmptyKey")); return; }
    setEnvSaving(true);
    try {
      const res = await fetch("/api/env", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vars: envVars }),
      });
      if (res.status === 405) { setEnvReadOnly(true); setEnvError(t("settings.envEditorUnavailable")); return; }
      if (res.status === 401 || res.status === 403) { setEnvError("Keine Berechtigung (Admin erforderlich). Bitte neu einloggen."); return; }
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setEnvError(data.message ?? t("settings.envEditorError"));
      } else {
        setEnvSaved(true);
        setTimeout(() => setEnvSaved(false), 5000);
      }
    } catch {
      setEnvError(t("settings.envEditorError"));
    } finally {
      setEnvSaving(false);
    }
  }

  // ── Download logs ─────────────────────────────────────────────────────────────

  async function handleDownloadLogs() {
    setDownloading(true);
    setDlError(null);
    try {
      const res = await fetch("/api/logs?tail=10000", { cache: "no-store" });
      if (!res.ok) { setDlError(`HTTP ${res.status}`); return; }
      const data = (await res.json()) as { enabled?: boolean; entries?: Record<string, unknown>[] };
      if (!data.enabled) { setDlError(t("settings.logsNotConfigured")); return; }
      const lines = (data.entries ?? []).map((e) => JSON.stringify(e)).join("\n");
      const blob  = new Blob([lines], { type: "application/x-ndjson" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href      = url;
      a.download  = `zetlab-logs-${new Date().toISOString().slice(0, 10)}.ndjson`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setDlError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");

  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />

      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[800px] mx-auto space-y-5">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary">
            <BackButton />
            <span>|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("settings.title")}</span>
          </nav>

          <h1 className="text-[20px] font-medium text-zt-text-primary">{t("settings.title")}</h1>

          {/* ── 1. User Profile ─────────────────────────────────────────────── */}
          <Card title={t("settings.profile")}>
            {profile ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
                <dt className="text-zt-text-tertiary">{t("settings.profileUsername")}</dt>
                <dd className="font-mono text-zt-text-primary">{profile.username}</dd>
                {fullName && <>
                  <dt className="text-zt-text-tertiary">{t("settings.profileName")}</dt>
                  <dd className="text-zt-text-primary">{fullName}</dd>
                </>}
                {profile.organization && <>
                  <dt className="text-zt-text-tertiary">{t("settings.profileOrganization")}</dt>
                  <dd className="text-zt-text-primary">{profile.organization}</dd>
                </>}
                {profile.email && <>
                  <dt className="text-zt-text-tertiary">{t("profile.email")}</dt>
                  <dd className="text-zt-text-primary">{profile.email}</dd>
                </>}
              </dl>
            ) : (
              <p className="text-[13px] text-zt-text-tertiary">{t("common.loading")}</p>
            )}
            <div className="mt-3 pt-3 border-t border-zt-border">
              <Link href="/profile" className="text-[13px] text-zt-primary hover:underline">
                {t("settings.profileEditLink")} →
              </Link>
            </div>
          </Card>

          {/* ── 2. Browser-Einstellungen ─────────────────────────────────────── */}
          <Card title={t("settings.clientSettings")}>
            <div className="space-y-4">
              {/* Log level — suppress hydration mismatch (value comes from localStorage) */}
              {mounted && (
                <Select
                  label={t("settings.logLevel")}
                  hint={t("settings.logLevelHelp")}
                  options={LOG_LEVEL_OPTIONS}
                  value={clientLogLevel}
                  onChange={(e) => setClientLogLevel(e.target.value as ClientLogLevel)}
                />
              )}

              {/* Language */}
              {mounted && (
                <Select
                  label={t("settings.language")}
                  options={LANGUAGE_OPTIONS}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as AppLanguage)}
                />
              )}

              {/* Debug mode */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="debugMode"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zt-border accent-zt-primary"
                />
                <div>
                  <label htmlFor="debugMode" className="text-[13px] font-medium text-zt-text-primary cursor-pointer">
                    {t("settings.debugMode")}
                  </label>
                  <p className="text-[12px] text-zt-text-tertiary mt-0.5">{t("settings.debugModeHelp")}</p>
                </div>
              </div>

              {saved && <p className="text-[13px] font-medium text-zt-success" role="status">{t("settings.saved")}</p>}
              {saveError && <p className="text-[13px] text-zt-danger" role="alert">{t("settings.validationError")}: {saveError}</p>}

              <div className="flex gap-3">
                <Button variant="primary"   onClick={handleSave}>{t("settings.save")}</Button>
                <Button variant="secondary" onClick={handleReset}>{t("settings.reset")}</Button>
              </div>
            </div>
          </Card>

          {/* ── 3. Server Settings (read-only) ───────────────────────────────── */}
          <Card title={t("settings.serverSettings")}>
            {server ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
                <dt className="text-zt-text-tertiary whitespace-nowrap">{t("settings.serverLogLevel")}</dt>
                <dd className="font-mono text-zt-text-primary">{server.logLevel}</dd>

                <dt className="text-zt-text-tertiary whitespace-nowrap">{t("settings.fileLogging")}</dt>
                <dd className="text-zt-text-primary">
                  {server.fileLoggingEnabled ? t("settings.fileLoggingEnabled") : t("settings.fileLoggingDisabled")}
                </dd>

                <dt className="text-zt-text-tertiary whitespace-nowrap">{t("settings.fhirUrl")}</dt>
                <dd className="font-mono text-[12px] text-zt-text-secondary break-all">{server.fhirBaseUrl}</dd>
              </dl>
            ) : (
              <p className="text-[13px] text-zt-text-tertiary">{t("common.loading")}</p>
            )}
            <p className="mt-4 border-t border-zt-border pt-3 text-[12px] text-zt-text-tertiary">{t("settings.serverNote")}</p>
          </Card>

          {/* ── 4. Logs ─────────────────────────────────────────────────────── */}
          <Card title={t("settings.logViewer")}>
            <p className="text-[13px] text-zt-text-secondary mb-4">{t("settings.logsDesc")}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="secondary" onClick={handleDownloadLogs} loading={downloading}>
                ↓ {t("settings.logsDownload")}
              </Button>
              <Link
                href="/admin/logs"
                className="text-[13px] px-4 py-2 rounded-lg border border-zt-border text-zt-text-primary hover:bg-zt-bg-card transition-colors"
              >
                {t("settings.logsOpen")} →
              </Link>
            </div>
            {dlError && <p className="mt-3 text-[13px] text-zt-danger">{dlError}</p>}
          </Card>

          {/* ── 5. Observability ─────────────────────────────────────────────── */}
          <Card title={t("settings.observability")}>
            {server ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
                <dt className="text-zt-text-tertiary whitespace-nowrap">Tracing</dt>
                <dd>
                  {server.enableTracing
                    ? <span className="text-zt-success">{t("settings.tracingEnabled")}</span>
                    : <span className="text-zt-text-tertiary">{t("settings.tracingDisabled")}</span>}
                </dd>
                {server.tracingUrl && <>
                  <dt className="text-zt-text-tertiary whitespace-nowrap">{t("settings.tracingUrl")}</dt>
                  <dd className="font-mono text-[12px] text-zt-text-secondary break-all">{server.tracingUrl}</dd>
                </>}
                {server.monitoringUrl && <>
                  <dt className="text-zt-text-tertiary whitespace-nowrap">{t("settings.monitoringUrl")}</dt>
                  <dd className="font-mono text-[12px] text-zt-text-secondary break-all">
                    {server.monitoringUrl}{" "}
                    <a href={server.monitoringUrl} target="_blank" rel="noopener noreferrer" className="text-zt-primary hover:underline text-[12px]">
                      {t("settings.monitoringOpen")}
                    </a>
                  </dd>
                </>}
                {!server.tracingUrl && !server.monitoringUrl && (
                  <dd className="col-span-2 text-[12px] text-zt-text-tertiary italic">
                    ENABLE_TRACING, TRACING_URL, MONITORING_URL — nicht konfiguriert.
                  </dd>
                )}
              </dl>
            ) : (
              <p className="text-[13px] text-zt-text-tertiary">{t("common.loading")}</p>
            )}
          </Card>

          {/* ── 6. Environment Variables Editor ──────────────────────────────── */}
          <Card title={t("settings.envEditor")} headerAction={
            <Link href="/admin/env" className="text-[12px] text-zt-primary hover:underline">
              {t("settings.envSchemaLink")}
            </Link>
          }>
            {envReadOnly ? (
              <div className="flex gap-2 rounded-md border border-zt-info-border bg-zt-info-light px-3 py-2 text-[12px] text-zt-info" role="note">
                <span className="shrink-0 font-bold">ℹ</span>
                <span>{t("settings.envEditorUnavailable")}</span>
              </div>
            ) : (
              <>
                <div className="mb-4 flex gap-2 rounded-md border border-zt-warning-border bg-zt-warning-bg px-3 py-2 text-[12px] text-zt-warning-text" role="note">
                  <span className="shrink-0 font-bold">⚠</span>
                  <span>{t("settings.envEditorRestartNote")}</span>
                </div>
                <p className="text-[12px] text-zt-text-tertiary mb-4">{t("settings.envEditorHelp")}</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[11px] font-medium text-zt-text-tertiary px-1">
                    <span>{t("settings.envEditorKey")}</span>
                    <span>{t("settings.envEditorValue")}</span>
                    <span />
                  </div>
                  {envVars.map((v, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input
                        type="text"
                        value={v.key}
                        onChange={(e) => handleEnvChange(i, "key", e.target.value)}
                        placeholder="VARIABLE_NAME"
                        className="rounded border border-zt-border px-2 py-1 text-[12px] font-mono bg-zt-bg-page text-zt-text-primary focus:outline-none focus:border-zt-primary"
                        aria-label={t("settings.envEditorKey")}
                      />
                      <input
                        type="text"
                        value={v.value}
                        onChange={(e) => handleEnvChange(i, "value", e.target.value)}
                        placeholder="value"
                        className="rounded border border-zt-border px-2 py-1 text-[12px] font-mono bg-zt-bg-page text-zt-text-primary focus:outline-none focus:border-zt-primary"
                        aria-label={t("settings.envEditorValue")}
                      />
                      <button
                        type="button"
                        onClick={() => setEnvVars((prev) => prev.filter((_, j) => j !== i))}
                        className="text-zt-danger hover:text-zt-danger/80 text-[12px] px-1"
                        aria-label={t("settings.envEditorDelete")}
                      >✕</button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={() => setEnvVars((p) => [...p, { key: "", value: "" }])}>
                    + {t("settings.envEditorAdd")}
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleEnvSave} loading={envSaving}>
                    {t("settings.envEditorSave")}
                  </Button>
                </div>
                {envSaved && <p className="mt-3 text-[13px] font-medium text-zt-success" role="status">{t("settings.envEditorSaved")}</p>}
                {envError && <p className="mt-3 text-[13px] text-zt-danger"      role="alert">{envError}</p>}
              </>
            )}
          </Card>

          {/* ── 7. App Info ───────────────────────────────────────────────────── */}
          <Card title={t("settings.appInfo")}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-zt-text-tertiary">{t("settings.version")}</dt>
              <dd className="font-mono text-zt-text-primary">{server?.appVersion ?? "…"}</dd>

              <dt className="text-zt-text-tertiary whitespace-nowrap">{t("settings.apiDocs")}</dt>
              <dd>
                <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="text-zt-primary hover:underline">
                  /api/docs
                </a>
              </dd>
            </dl>
          </Card>

        </div>
      </div>
    </div>
  );
}
