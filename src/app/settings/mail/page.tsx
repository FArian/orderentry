"use client";

/**
 * /settings/mail — Mail Server Configuration
 *
 * Read-only reference page: shows the active mail config (from ENV) and
 * the required ENV variables for each provider/auth combination.
 * Credentials are never editable through the UI — they must be set via ENV.
 *
 * Admin role required (enforced by useSession redirect).
 */

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { Card } from "@/presentation/ui/Card";
import { Badge } from "@/presentation/ui/Badge";
import { Button } from "@/presentation/ui/Button";
import { useTranslation } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { MailProvider, MailAuthType } from "@/infrastructure/mail/types/MailConfig";
import { MAIL_PROVIDERS, MAIL_AUTH_TYPES, PROVIDER_AUTH_MATRIX } from "@/infrastructure/mail/types/MailConfig";

// ── ENV guide ─────────────────────────────────────────────────────────────────

interface EnvVar {
  name: string;
  example: string;
  secret: boolean;
  optional?: boolean;
}

interface ProviderGuide {
  label: string;
  authTypes: readonly MailAuthType[];
  /** host = resolved MAIL_HOST value (from preset or custom input) */
  vars: (authType: MailAuthType, host?: string) => EnvVar[];
  /** Technical notes (English, shown as info box). */
  notes?: string;
  /**
   * i18n key for the user-facing help text shown above the notes.
   * Use for warnings (e.g. "Gmail is dev-only") and guidance ("use for hospital SMTP").
   */
  helpKey?: string;
}

// ── Server presets ────────────────────────────────────────────────────────────

interface ServerPreset {
  label:  string;
  host:   string;   // empty string = custom entry
  port:   string;
}

const SERVER_PRESETS: ServerPreset[] = [
  // ── Test / Entwicklung ──────────────────────────────────────────────────────
  { label: "🧪 Mailpit (lokal, Docker — empfohlen für Tests)", host: "localhost",             port: "1025" },
  { label: "🧪 Mailpit (im Docker-Netzwerk)",                  host: "mailpit",              port: "1025" },
  { label: "🧪 Ethereal Email (nodemailer Testdienst)",        host: "smtp.ethereal.email",  port: "587"  },
  // ── Produktion ─────────────────────────────────────────────────────────────
  { label: "Infomaniak (HIN-zertifiziert)",                    host: "mail.infomaniak.com",  port: "587"  },
  { label: "Microsoft Exchange Online / Office 365",           host: "smtp.office365.com",   port: "587"  },
  { label: "Outlook.com / Hotmail",                            host: "smtp-mail.outlook.com",port: "587"  },
  { label: "Google Workspace Relay",                           host: "smtp-relay.gmail.com", port: "587"  },
  { label: "ProtonMail Bridge (lokal)",                        host: "127.0.0.1",            port: "1025" },
  { label: "Eigener Server / Exchange intern",                 host: "",                     port: "587"  },
];

/** Providers that require a MAIL_HOST (gmail uses service preset, relay has fixed host). */
const PROVIDERS_WITH_HOST_SELECTOR: readonly MailProvider[] = ["smtp", "smtp_oauth2", "hin"];

// ── Server preset selector component ─────────────────────────────────────────

interface ServerPresetSelectorProps {
  host:       string;
  port:       string;
  onHostChange: (host: string) => void;
  onPortChange: (port: string) => void;
}

function ServerPresetSelector({ host, port, onHostChange, onPortChange }: ServerPresetSelectorProps) {
  const { t } = useTranslation();

  const matchedPreset = SERVER_PRESETS.find((p) => p.host && p.host === host);
  const isCustom      = !matchedPreset;

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === "__custom__") {
      onHostChange("");
      return;
    }
    const preset = SERVER_PRESETS.find((p) => p.host === value);
    if (preset) {
      onHostChange(preset.host);
      onPortChange(preset.port);
    }
  }

  return (
    <div className="mb-4 p-3 bg-zt-bg-muted border border-zt-border rounded-lg">
      <p className="text-[11px] font-medium text-zt-text-secondary mb-2">
        {t("mail.serverPresetLabel")}
      </p>
      <div className="flex flex-col gap-2">
        <select
          value={isCustom ? "__custom__" : host}
          onChange={handleSelect}
          className="w-full px-3 py-1.5 text-[12px] border border-zt-border rounded bg-zt-bg-card text-zt-text-primary focus:outline-none focus:border-zt-primary"
        >
          <option value="">{t("mail.serverPresetChoose")}</option>
          {SERVER_PRESETS.map((p) => (
            <option key={p.host || "__custom__"} value={p.host || "__custom__"}>
              {p.label}
            </option>
          ))}
        </select>

        {isCustom && (
          <div className="flex gap-2">
            <input
              type="text"
              value={host}
              onChange={(e) => onHostChange(e.target.value)}
              placeholder={t("mail.serverHostPlaceholder")}
              className="flex-1 px-3 py-1.5 text-[12px] border border-zt-border rounded bg-zt-bg-page text-zt-text-primary placeholder:text-zt-text-tertiary focus:outline-none focus:border-zt-primary font-mono"
            />
            <input
              type="text"
              value={port}
              onChange={(e) => onPortChange(e.target.value)}
              placeholder="587"
              className="w-20 px-3 py-1.5 text-[12px] border border-zt-border rounded bg-zt-bg-page text-zt-text-primary placeholder:text-zt-text-tertiary focus:outline-none focus:border-zt-primary font-mono"
            />
          </div>
        )}

        {(host || port) && (
          <p className="text-[11px] text-zt-text-tertiary font-mono">
            MAIL_HOST={host || "…"} &nbsp; MAIL_PORT={port || "587"}
          </p>
        )}
      </div>
    </div>
  );
}

// ── HIN nDSG notice (rendered separately for HIN provider) ───────────────────

function HinNotice({ isConfigured }: { isConfigured: boolean }) {
  const { t } = useTranslation();

  if (isConfigured) {
    return (
      <div className="mb-4 p-4 bg-zt-success-light border border-zt-success-border rounded-lg">
        <p className="text-[12px] font-semibold text-zt-success mb-1">
          ✓ HIN (Health Info Net) — {t("mail.hinConfigured")}
        </p>
        <p className="text-[11px] text-zt-success">{t("mail.hinConfiguredText")}</p>
      </div>
    );
  }

  return (
    <div className="mb-4 p-4 bg-zt-danger-light border border-zt-danger-border rounded-lg">
      <p className="text-[12px] font-semibold text-zt-danger mb-1">
        ⚠ {t("mail.hinNdsgTitle")}
      </p>
      <p className="text-[12px] text-zt-danger mb-2">{t("mail.hinNdsgText")}</p>
      <ul className="text-[11px] text-zt-danger list-disc list-inside space-y-0.5">
        <li>{t("mail.hinOption1")}</li>
        <li>{t("mail.hinOption2")}</li>
        <li>{t("mail.hinOption3")}</li>
      </ul>
      <p className="text-[11px] text-zt-text-tertiary mt-2">{t("mail.hinMore")}</p>
    </div>
  );
}

const PROVIDER_GUIDES: Record<MailProvider, ProviderGuide> = {
  smtp: {
    label: "SMTP",
    helpKey: "mail.smtpHelp",
    authTypes: ["APP_PASSWORD", "OAUTH2"],
    vars: (auth, host) => [
      { name: "MAIL_PROVIDER",  example: "smtp",                         secret: false },
      { name: "MAIL_AUTH_TYPE", example: auth,                           secret: false },
      { name: "MAIL_HOST",      example: host || "smtp.example.com",     secret: false },
      { name: "MAIL_PORT",      example: "587",                          secret: false, optional: true },
      { name: "MAIL_SECURE",    example: "false",                        secret: false, optional: true },
      { name: "MAIL_USER",      example: "user@example.com",             secret: false },
      ...(auth === "APP_PASSWORD"
        ? [{ name: "MAIL_PASSWORD",          example: "your-password",    secret: true  }]
        : [
            { name: "MAIL_OAUTH_CLIENT_ID",     example: "client-id",        secret: false },
            { name: "MAIL_OAUTH_CLIENT_SECRET", example: "client-secret",     secret: true  },
            { name: "MAIL_OAUTH_REFRESH_TOKEN", example: "refresh-token",     secret: true  },
          ]
      ),
      { name: "MAIL_FROM",      example: "OrderEntry <noreply@example.com>", secret: false },
      { name: "MAIL_ALIAS",     example: "noreply@example.com",             secret: false, optional: true },
    ],
  },
  gmail: {
    label: "Gmail",
    helpKey: "mail.gmailHelp",
    authTypes: ["APP_PASSWORD", "OAUTH2"],
    notes: "APP_PASSWORD requires 2-Step Verification enabled and an App Password generated at myaccount.google.com/apppasswords. No MAIL_HOST needed — nodemailer uses the Gmail service preset.",
    vars: (auth) => [
      { name: "MAIL_PROVIDER",  example: "gmail",            secret: false },
      { name: "MAIL_AUTH_TYPE", example: auth,               secret: false },
      { name: "MAIL_USER",      example: "user@gmail.com",   secret: false },
      ...(auth === "APP_PASSWORD"
        ? [{ name: "MAIL_PASSWORD",          example: "your-app-password",   secret: true }]
        : [
            { name: "MAIL_OAUTH_CLIENT_ID",     example: "client-id",            secret: false },
            { name: "MAIL_OAUTH_CLIENT_SECRET", example: "client-secret",         secret: true  },
            { name: "MAIL_OAUTH_REFRESH_TOKEN", example: "1//refresh-token",      secret: true  },
          ]
      ),
      { name: "MAIL_FROM",      example: "OrderEntry <user@gmail.com>",     secret: false },
    ],
  },
  smtp_oauth2: {
    label: "SMTP + OAuth2",
    authTypes: ["OAUTH2"],
    notes: "Use this for Microsoft Exchange Online (Office 365), Outlook.com, or any SMTP server with modern authentication.",
    vars: (_auth, host) => [
      { name: "MAIL_PROVIDER",            example: "smtp_oauth2",                       secret: false },
      { name: "MAIL_AUTH_TYPE",           example: "OAUTH2",                            secret: false },
      { name: "MAIL_HOST",                example: host || "smtp.office365.com",        secret: false },
      { name: "MAIL_PORT",                example: "587",                               secret: false, optional: true },
      { name: "MAIL_USER",                example: "user@company.com",    secret: false },
      { name: "MAIL_OAUTH_CLIENT_ID",     example: "azure-client-id",     secret: false },
      { name: "MAIL_OAUTH_CLIENT_SECRET", example: "azure-client-secret", secret: true  },
      { name: "MAIL_OAUTH_REFRESH_TOKEN", example: "refresh-token",       secret: true  },
      { name: "MAIL_FROM",                example: "OrderEntry <noreply@company.com>", secret: false },
    ],
  },
  hin: {
    label: "HIN (Health Info Net)",
    authTypes: ["APP_PASSWORD"],
    notes: "HIN ist der Schweizer Standard für sichere Gesundheitskommunikation (S/MIME-verschlüsselt). Die Verschlüsselung erfolgt transparent im HIN-Gateway — nodemailer sendet per Standard-SMTP. Empfohlener Gateway-Anbieter: Infomaniak (HIN-zertifiziert) oder SeppMail HIN Connector.",
    vars: (_auth, host) => [
      { name: "MAIL_PROVIDER",  example: "hin",                                    secret: false },
      { name: "MAIL_AUTH_TYPE", example: "APP_PASSWORD",                           secret: false },
      { name: "MAIL_HOST",      example: host || "mail.infomaniak.com",            secret: false },
      { name: "MAIL_PORT",      example: "587",                          secret: false, optional: true },
      { name: "MAIL_USER",      example: "vorname.nachname@hin.ch",      secret: false },
      { name: "MAIL_PASSWORD",  example: "hin-gateway-passwort",         secret: true  },
      { name: "MAIL_FROM",      example: "Labor <noreply@hin.ch>",       secret: false },
      { name: "MAIL_ALIAS",     example: "noreply@zlz.ch",               secret: false, optional: true },
    ],
  },
  google_workspace_relay: {
    label: "Google Workspace Relay",
    authTypes: ["NONE", "APP_PASSWORD"],
    notes: "Relay via smtp-relay.gmail.com. Configure in Google Workspace Admin → Apps → Google Workspace → Gmail → Routing. IP-based auth (NONE) requires whitelisting the server IP in Google Admin.",
    vars: (auth) => [
      { name: "MAIL_PROVIDER",  example: "google_workspace_relay",  secret: false },
      { name: "MAIL_AUTH_TYPE", example: auth,                      secret: false },
      { name: "MAIL_HOST",      example: "smtp-relay.gmail.com",    secret: false, optional: true },
      { name: "MAIL_PORT",      example: "587",                     secret: false, optional: true },
      ...(auth === "APP_PASSWORD"
        ? [
            { name: "MAIL_USER",     example: "sender@workspace.com", secret: false },
            { name: "MAIL_PASSWORD", example: "app-password",         secret: true  },
          ]
        : []
      ),
      { name: "MAIL_FROM",      example: "OrderEntry <noreply@workspace.com>", secret: false },
      { name: "MAIL_DOMAIN",    example: "workspace.com",            secret: false, optional: true },
    ],
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function EnvVarRow({ name, example, secret, optional }: EnvVar) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-zt-border last:border-0 text-[12px]">
      <code className="w-56 shrink-0 font-mono text-zt-primary font-semibold">{name}</code>
      <span className="flex-1">
        {secret
          ? <span className="text-zt-warning-text font-medium">⚠ Secret — nur als ENV setzen</span>
          : <span className="font-mono text-zt-text-tertiary">z.B. {example}</span>}
      </span>
      {optional && <span className="text-zt-text-tertiary italic shrink-0">optional</span>}
    </div>
  );
}

// ── Test result type ──────────────────────────────────────────────────────────

interface TestResult {
  ok: boolean;
  message: string;
  durationMs?: number;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MailConfigPage() {
  const { t } = useTranslation();
  const { isAdmin, status } = useSession();

  const [activeProvider, setActiveProvider] = useState<MailProvider | "">("");
  const [activeAuth, setActiveAuth]         = useState<MailAuthType | "">("");
  const [mailFrom, setMailFrom]             = useState("");
  const [selectedProvider, setSelectedProvider] = useState<MailProvider>("smtp");
  const [selectedAuth, setSelectedAuth]         = useState<MailAuthType>("APP_PASSWORD");

  const [selectedHost, setSelectedHost] = useState("");
  const [selectedPort, setSelectedPort] = useState("587");

  const [testing, setTesting]         = useState(false);
  const [testResult, setTestResult]   = useState<TestResult | null>(null);
  const [sendEmail, setSendEmail]     = useState(false);
  const [testTo, setTestTo]           = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { mailProvider?: string; mailAuthType?: string; mailFrom?: string } | null) => {
        if (!d) return;
        const prov = d.mailProvider ?? "";
        const auth = d.mailAuthType ?? "";
        setActiveProvider(prov as MailProvider | "");
        setActiveAuth(auth as MailAuthType | "");
        setMailFrom(d.mailFrom ?? "");
        if (prov && (MAIL_PROVIDERS as readonly string[]).includes(prov)) {
          setSelectedProvider(prov as MailProvider);
        }
        if (auth && (MAIL_AUTH_TYPES as readonly string[]).includes(auth)) {
          setSelectedAuth(auth as MailAuthType);
        }
      })
      .catch(() => {});
  }, []);

  // Keep selected auth in sync with provider's allowed methods
  const allowedAuth = PROVIDER_AUTH_MATRIX[selectedProvider] as readonly MailAuthType[];
  useEffect(() => {
    if (!allowedAuth.includes(selectedAuth)) {
      setSelectedAuth(allowedAuth[0] ?? "APP_PASSWORD");
    }
    // Reset host preset when switching providers
    setSelectedHost("");
    setSelectedPort("587");
  }, [selectedProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const start = Date.now();
      const body: { sendEmail?: boolean; to?: string } = sendEmail && testTo
        ? { sendEmail: true, to: testTo }
        : {};
      const res  = await fetch("/api/v1/admin/mail/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      setTestResult({ ok: !!data.ok, message: data.message ?? (res.ok ? "OK" : "Fehler"), durationMs: Date.now() - start });
    } catch (e: unknown) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Verbindung fehlgeschlagen" });
    } finally {
      setTesting(false);
    }
  }

  if (status === "loading") return null;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen bg-zt-bg-page">
        <AppSidebar />
        <main className="flex-1 p-8">
          <p className="text-[13px] text-zt-text-tertiary">{t("common.accessDenied")}</p>
        </main>
      </div>
    );
  }

  const guide = PROVIDER_GUIDES[selectedProvider];

  return (
    <div className="flex min-h-screen bg-zt-bg-page">
      <AppSidebar />

      <main className="flex-1 p-8 max-w-3xl">
        <div className="mb-4">
          <BackButton />
        </div>
        <h1 className="text-xl font-semibold text-zt-text-primary mb-1">
          {t("mail.title")}
        </h1>
        <p className="text-[13px] text-zt-text-secondary mb-6">
          {t("mail.desc")}
        </p>

        {/* Security notice */}
        <div className="mb-6 p-4 bg-zt-warning-bg border border-zt-warning-border rounded-lg">
          <p className="text-[12px] text-zt-warning-text">{t("mail.securityNotice")}</p>
        </div>

        {/* Current status */}
        <Card title={t("mail.currentStatus")} className="mb-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-zt-text-tertiary">{t("mail.providerLabel")}</dt>
            <dd>
              <Badge
                label={activeProvider || t("mail.notConfigured")}
                variant={activeProvider ? "success" : "neutral"}
              />
            </dd>
            <dt className="text-zt-text-tertiary">{t("mail.authTypeLabel")}</dt>
            <dd>
              <Badge
                label={activeAuth || "—"}
                variant={activeAuth ? "info" : "neutral"}
              />
            </dd>
            {mailFrom && (
              <>
                <dt className="text-zt-text-tertiary">{t("mail.fromLabel")}</dt>
                <dd className="font-mono text-[12px] text-zt-text-secondary">{mailFrom}</dd>
              </>
            )}
          </dl>

          {/* Test connection */}
          <div className="mt-4 pt-3 border-t border-zt-border">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <Button
                variant="secondary"
                onClick={handleTest}
                loading={testing}
                disabled={!activeProvider}
              >
                {t("mail.testConnection")}
              </Button>
              {testResult && (
                <span className={`text-[12px] font-medium ${testResult.ok ? "text-zt-success" : "text-zt-danger"}`}>
                  {testResult.ok ? "✓" : "✗"} {testResult.message}
                  {testResult.durationMs !== undefined && (
                    <span className="ml-1 text-zt-text-tertiary font-normal">({testResult.durationMs} ms)</span>
                  )}
                </span>
              )}
            </div>

            {/* Send test email toggle */}
            <label className="flex items-center gap-2 text-[12px] text-zt-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="rounded"
              />
              {t("mail.sendTestEmail")}
            </label>
            {sendEmail && (
              <div className="mt-2 flex gap-2">
                <input
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder={t("mail.testEmailPlaceholder")}
                  className="flex-1 px-3 py-1.5 text-[12px] border border-zt-border rounded bg-zt-bg-page text-zt-text-primary placeholder:text-zt-text-tertiary focus:outline-none focus:border-zt-primary"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Provider + Auth selector */}
        <Card title={t("mail.reference")} className="mb-6">
          <p className="text-[13px] text-zt-text-secondary mb-4">{t("mail.referenceDesc")}</p>

          <div className="flex flex-wrap gap-3 mb-4">
            {MAIL_PROVIDERS.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedProvider(p)}
                className={`px-3 py-1.5 text-[12px] rounded-md border font-medium transition-colors ${
                  selectedProvider === p
                    ? "border-zt-primary bg-zt-primary-light text-zt-primary"
                    : "border-zt-border bg-zt-bg-card text-zt-text-secondary hover:border-zt-primary hover:text-zt-primary"
                }`}
              >
                {PROVIDER_GUIDES[p].label}
              </button>
            ))}
          </div>

          {/* Auth type tabs */}
          {allowedAuth.length > 1 && (
            <div className="flex gap-2 mb-4">
              {allowedAuth.map((a) => (
                <button
                  key={a}
                  onClick={() => setSelectedAuth(a)}
                  className={`px-3 py-1 text-[11px] rounded border font-medium transition-colors ${
                    selectedAuth === a
                      ? "border-zt-primary bg-zt-primary text-white"
                      : "border-zt-border text-zt-text-tertiary hover:border-zt-primary"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          )}

          {/* HIN: nDSG legal notice — green when configured, red when not */}
          {selectedProvider === "hin" && <HinNotice isConfigured={activeProvider === "hin"} />}

          {/* Server host preset selector — shown for providers that need MAIL_HOST */}
          {PROVIDERS_WITH_HOST_SELECTOR.includes(selectedProvider) && (
            <ServerPresetSelector
              host={selectedHost}
              port={selectedPort}
              onHostChange={setSelectedHost}
              onPortChange={setSelectedPort}
            />
          )}

          {/* Provider help text (i18n — user-facing guidance / warnings) */}
          {guide.helpKey && (
            <div className={`mb-4 p-3 rounded border text-[12px] ${
              selectedProvider === "gmail"
                ? "bg-zt-warning-bg border-zt-warning-border text-zt-warning-text"
                : "bg-zt-info-light border-zt-info-border text-zt-info"
            }`}>
              {t(guide.helpKey)}
            </div>
          )}

          {/* Technical notes (English, provider-specific setup details) */}
          {guide.notes && (
            <div className="mb-4 p-3 bg-zt-bg-muted border border-zt-border rounded text-[12px] text-zt-text-secondary">
              {guide.notes}
            </div>
          )}

          {/* ENV var list */}
          <div className="rounded border border-zt-border overflow-hidden">
            {guide.vars(selectedAuth, selectedHost || undefined).map((v) => <EnvVarRow key={v.name} {...v} />)}
          </div>
        </Card>

        {/* All providers overview */}
        <Card title={t("mail.allProviders")}>
          <div className="grid grid-cols-2 gap-3">
            {MAIL_PROVIDERS.map((p) => (
              <div
                key={p}
                className={`rounded border p-3 ${
                  activeProvider === p
                    ? "border-zt-primary bg-zt-primary-light"
                    : "border-zt-border bg-zt-bg-card"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-semibold text-zt-text-primary">
                    {PROVIDER_GUIDES[p].label}
                  </span>
                  {activeProvider === p && <Badge label={t("mail.active")} variant="success" />}
                </div>
                <p className="text-[11px] text-zt-text-tertiary">
                  {PROVIDER_GUIDES[p].authTypes.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Contact */}
        <p className="mt-6 text-[12px] text-zt-text-tertiary">
          {t("mail.contactHint")}{" "}
          <a
            href="mailto:Farhad.Arian@zlz.ch"
            className="text-zt-primary hover:underline"
          >
            Farhad.Arian@zlz.ch
          </a>
        </p>
      </main>
    </div>
  );
}
