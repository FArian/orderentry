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

    fetch("/api/me/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { username?: string; profile?: UserProfile } | null) => {
        if (data) {
          setProfile({
            username:     data.username ?? "",
            firstName:    (data.profile as Record<string, string> | undefined)?.firstName,
            lastName:     (data.profile as Record<string, string> | undefined)?.lastName,
            organization: (data.profile as Record<string, string> | undefined)?.organization,
            email:        (data.profile as Record<string, string> | undefined)?.email,
          });
        }
      })
      .catch(() => {});
  }, []);

  function handleSave() {
    setSaveError(null);
    const errors = RuntimeConfig.validate({ logLevel: clientLogLevel, language });
    if (errors.length > 0) {
      setSaveError(errors[0]);
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

      {/* ── 5. Log Viewer ───────────────────────────────────────────────────── */}
      <Card title={t("settings.logViewer")}>
        <LogViewer />
      </Card>

      {/* ── 6. App Info ─────────────────────────────────────────────────────── */}
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
