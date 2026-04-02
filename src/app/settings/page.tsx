"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Card, Select, Button } from "@/presentation/ui";
import { LogViewer } from "@/presentation/components/LogViewer";
import {
  RuntimeConfig,
  type ClientLogLevel,
  type AppLanguage,
} from "@/shared/config/RuntimeConfig";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnvVar {
  key: string;
  value: string;
}

interface ServerSettings {
  logLevel:           string;
  fileLoggingEnabled: boolean;
  fhirBaseUrl:        string;
  appVersion:         string;
  enableTracing:      boolean;
  zipkinUrl:          string;
  grafanaUrl:         string;
}

interface UserProfile {
  username:    string;
  firstName?:  string;
  lastName?:   string;
  organization?: string;
  email?:      string;
}

// ── Option lists ──────────────────────────────────────────────────────────────

const LOG_LEVEL_OPTIONS: Array<{ value: ClientLogLevel; label: string }> = [
  { value: "debug",  label: "debug"  },
  { value: "info",   label: "info"   },
  { value: "warn",   label: "warn"   },
  { value: "error",  label: "error"  },
  { value: "silent", label: "silent" },
];

const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; label: string }> = [
  { value: "de", label: "Deutsch"   },
  { value: "en", label: "English"   },
  { value: "fr", label: "Français"  },
  { value: "it", label: "Italiano"  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useTranslation();

  // Client settings
  const [clientLogLevel, setClientLogLevel] = useState<ClientLogLevel>("info");
  const [language,       setLanguage]       = useState<AppLanguage>("de");
  const [debugMode,      setDebugMode]      = useState(false);

  // Server / user data
  const [server,  setServer]  = useState<ServerSettings | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Env editor
  const [envVars,        setEnvVars]        = useState<EnvVar[]>([]);
  const [envSaved,       setEnvSaved]       = useState(false);
  const [envError,       setEnvError]       = useState<string | null>(null);
  const [envSaving,      setEnvSaving]      = useState(false);
  const [envReadOnly,    setEnvReadOnly]    = useState(false);   // true on Vercel

  // Feedback
  const [saved,       setSaved]       = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);

  // Load from localStorage + API
  useEffect(() => {
    const s = RuntimeConfig.get();
    setClientLogLevel(s.logLevel);
    setLanguage(s.language);
    setDebugMode(s.debugMode);

    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ServerSettings | null) => { if (data) setServer(data); })
      .catch(() => {});

    fetch("/api/env")
      .then((r) => {
        // 405 = Vercel / read-only environment — editing not supported
        if (r.status === 405) { setEnvReadOnly(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((data: { vars?: EnvVar[] } | null) => {
        if (data?.vars) setEnvVars(data.vars);
      })
      .catch(() => {});

    fetch("/api/me/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { username?: string; profile?: UserProfile } | null) => {
        if (data) {
          const profile = data.profile as Record<string, string> | undefined;
          setProfile({
            username: data.username ?? "",
            ...(profile?.firstName    !== undefined && { firstName:    profile.firstName }),
            ...(profile?.lastName     !== undefined && { lastName:     profile.lastName }),
            ...(profile?.organization !== undefined && { organization: profile.organization }),
            ...(profile?.email        !== undefined && { email:        profile.email }),
          });
        }
      })
      .catch(() => {});
  }, []);

  function handleSave() {
    setSaveError(null);
    const errors = RuntimeConfig.validate({ logLevel: clientLogLevel, language });
    if (errors.length > 0) {
      setSaveError(errors[0] ?? null);
      return;
    }
    RuntimeConfig.set({ logLevel: clientLogLevel, language, debugMode });
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

  // ── Env editor handlers ────────────────────────────────────────────────────

  function handleEnvChange(index: number, field: "key" | "value", val: string) {
    setEnvVars((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: val } : v)),
    );
  }

  function handleEnvAdd() {
    setEnvVars((prev) => [...prev, { key: "", value: "" }]);
  }

  function handleEnvDelete(index: number) {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleEnvSave() {
    setEnvError(null);
    const emptyKey = envVars.find((v) => !v.key.trim());
    if (emptyKey !== undefined) {
      setEnvError(t("settings.envEditorEmptyKey"));
      return;
    }
    setEnvSaving(true);
    try {
      const res = await fetch("/api/env", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vars: envVars }),
      });
      if (res.status === 405) {
        setEnvReadOnly(true);
        setEnvError(t("settings.envEditorUnavailable"));
        return;
      }
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

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // ── Derived display values ─────────────────────────────────────────────────

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">
        {t("settings.title")}
      </h1>

      {/* ── 1. User Profile ─────────────────────────────────────────────────── */}
      <Card title={t("settings.profile")}>
        {profile ? (
          <dl className="space-y-2 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-4">
              <dt className="text-gray-500">{t("settings.profileUsername")}</dt>
              <dd className="font-mono text-gray-800">{profile.username}</dd>

              {fullName && (
                <>
                  <dt className="text-gray-500">{t("settings.profileName")}</dt>
                  <dd className="text-gray-800">{fullName}</dd>
                </>
              )}

              {profile.organization && (
                <>
                  <dt className="text-gray-500">{t("settings.profileOrganization")}</dt>
                  <dd className="text-gray-800">{profile.organization}</dd>
                </>
              )}

              {profile.email && (
                <>
                  <dt className="text-gray-500">{t("profile.email")}</dt>
                  <dd className="text-gray-800">{profile.email}</dd>
                </>
              )}
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-400">{t("common.loading")}</p>
        )}
        <div className="mt-3 pt-3 border-t">
          <Link
            href="/profile"
            className="text-sm text-blue-600 hover:underline"
          >
            {t("settings.profileEditLink")} →
          </Link>
        </div>
      </Card>

      {/* ── 2. Client (Browser) Settings ────────────────────────────────────── */}
      <Card title={t("settings.clientSettings")}>
        <div className="space-y-4">
          {/* Log level */}
          <Select
            label={t("settings.logLevel")}
            hint={t("settings.logLevelHelp")}
            options={LOG_LEVEL_OPTIONS}
            value={clientLogLevel}
            onChange={(e) => setClientLogLevel(e.target.value as ClientLogLevel)}
          />

          {/* Language */}
          <Select
            label={t("settings.language")}
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={(e) => setLanguage(e.target.value as AppLanguage)}
          />

          {/* Debug mode */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="debugMode"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <label htmlFor="debugMode" className="text-sm font-medium text-gray-700 cursor-pointer">
                {t("settings.debugMode")}
              </label>
              <p className="text-xs text-gray-500 mt-0.5">{t("settings.debugModeHelp")}</p>
            </div>
          </div>

          {/* Feedback */}
          {saved && (
            <p className="text-sm font-medium text-green-600" role="status">
              {t("settings.saved")}
            </p>
          )}
          {saveError && (
            <p className="text-sm text-red-600" role="alert">
              {t("settings.validationError")}: {saveError}
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="primary" onClick={handleSave}>
              {t("settings.save")}
            </Button>
            <Button variant="secondary" onClick={handleReset}>
              {t("settings.reset")}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── 3. Server Settings (read-only) ──────────────────────────────────── */}
      <Card title={t("settings.serverSettings")}>
        {server ? (
          <dl className="space-y-3 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-gray-500 whitespace-nowrap">{t("settings.serverLogLevel")}</dt>
              <dd className="font-mono text-gray-800">{server.logLevel}</dd>

              <dt className="text-gray-500 whitespace-nowrap">{t("settings.fileLogging")}</dt>
              <dd className="text-gray-800">
                {server.fileLoggingEnabled
                  ? t("settings.fileLoggingEnabled")
                  : t("settings.fileLoggingDisabled")}
              </dd>

              <dt className="text-gray-500 whitespace-nowrap">{t("settings.fhirUrl")}</dt>
              <dd className="font-mono text-xs text-gray-600 break-all">{server.fhirBaseUrl}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-400">{t("common.loading")}</p>
        )}
        <p className="mt-4 border-t pt-3 text-xs text-gray-400">
          {t("settings.serverNote")}
        </p>
      </Card>

      {/* ── 4. Observability ────────────────────────────────────────────────── */}
      <Card title={t("settings.observability")}>
        {server ? (
          <dl className="space-y-3 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-gray-500 whitespace-nowrap">Tracing</dt>
              <dd className="text-gray-800">
                {server.enableTracing
                  ? <span className="text-green-600">{t("settings.tracingEnabled")}</span>
                  : <span className="text-gray-400">{t("settings.tracingDisabled")}</span>}
              </dd>

              {server.zipkinUrl && (
                <>
                  <dt className="text-gray-500 whitespace-nowrap">{t("settings.zipkinUrl")}</dt>
                  <dd className="font-mono text-xs text-gray-600 break-all">{server.zipkinUrl}</dd>
                </>
              )}

              {server.grafanaUrl && (
                <>
                  <dt className="text-gray-500 whitespace-nowrap">{t("settings.grafanaUrl")}</dt>
                  <dd className="font-mono text-xs text-gray-600 break-all">
                    {server.grafanaUrl}
                    {" "}
                    <a
                      href={server.grafanaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs"
                    >
                      {t("settings.grafanaOpen")}
                    </a>
                  </dd>
                </>
              )}

              {!server.zipkinUrl && !server.grafanaUrl && (
                <dd className="col-span-2 text-gray-400 text-xs italic">
                  ENABLE_TRACING, ZIPKIN_URL, GRAFANA_URL — nicht konfiguriert.
                </dd>
              )}
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-400">{t("common.loading")}</p>
        )}
      </Card>

      {/* ── 5. Environment Variables Editor ─────────────────────────────────── */}
      <Card title={t("settings.envEditor")}>
        {/* Vercel / read-only environment — editing not supported */}
        {envReadOnly ? (
          <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800" role="note">
            <span className="shrink-0 font-bold">ℹ</span>
            <span>{t("settings.envEditorUnavailable")}</span>
          </div>
        ) : (
          <>
            {/* Always-visible restart warning */}
            <div className="mb-4 flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="note">
              <span className="shrink-0 font-bold">⚠</span>
              <span>{t("settings.envEditorRestartNote")}</span>
            </div>

            <p className="text-xs text-gray-500 mb-4">{t("settings.envEditorHelp")}</p>

            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-gray-500 px-1">
                <span>{t("settings.envEditorKey")}</span>
                <span>{t("settings.envEditorValue")}</span>
                <span />
              </div>

              {/* Rows */}
              {envVars.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={v.key}
                    onChange={(e) => handleEnvChange(i, "key", e.target.value)}
                    placeholder="VARIABLE_NAME"
                    className="rounded border border-gray-300 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    aria-label={t("settings.envEditorKey")}
                  />
                  <input
                    type="text"
                    value={v.value}
                    onChange={(e) => handleEnvChange(i, "value", e.target.value)}
                    placeholder="value"
                    className="rounded border border-gray-300 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    aria-label={t("settings.envEditorValue")}
                  />
                  <button
                    type="button"
                    onClick={() => handleEnvDelete(i)}
                    className="text-red-500 hover:text-red-700 text-xs px-1"
                    aria-label={t("settings.envEditorDelete")}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <Button variant="ghost" size="sm" onClick={handleEnvAdd}>
                + {t("settings.envEditorAdd")}
              </Button>
              <Button variant="primary" size="sm" onClick={handleEnvSave} loading={envSaving}>
                {t("settings.envEditorSave")}
              </Button>
            </div>

            {envSaved && (
              <p className="mt-3 text-sm font-medium text-green-600" role="status">
                {t("settings.envEditorSaved")}
              </p>
            )}
            {envError && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {envError}
              </p>
            )}
          </>
        )}
      </Card>

      {/* ── 6. Log Viewer ───────────────────────────────────────────────────── */}
      <Card title={t("settings.logViewer")}>
        <LogViewer />
      </Card>

      {/* ── 7. App Info ─────────────────────────────────────────────────────── */}
      <Card title={t("settings.appInfo")}>
        <dl className="space-y-3 text-sm">
          <div className="grid grid-cols-[auto_1fr] gap-x-4">
            <dt className="text-gray-500">{t("settings.version")}</dt>
            <dd className="font-mono text-gray-800">{server?.appVersion ?? "…"}</dd>

            <dt className="text-gray-500 whitespace-nowrap">{t("settings.apiDocs")}</dt>
            <dd>
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                /api/docs
              </a>
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
