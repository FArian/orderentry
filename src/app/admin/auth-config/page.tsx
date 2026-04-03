"use client";

/**
 * /admin/auth-config — FHIR Authorization Configuration
 *
 * Shows the currently active auth type and the ENV vars required for each
 * auth method. Credentials are NEVER shown or editable here for security —
 * they must be set via .env.local / docker-compose.yml directly.
 *
 * "Test Connection" button calls GET /api/fhir-health to verify the FHIR
 * connection using whatever auth is currently configured server-side.
 */

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { Card, Badge, Button } from "@/presentation/ui";
import { useTranslation } from "@/lib/i18n";
import type { AuthType } from "@/infrastructure/authorization/types/AuthConfig";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FhirAuthStatus {
  authType: AuthType;
  fhirBaseUrl: string;
}

interface TestResult {
  ok: boolean;
  status?: number;
  message: string;
  durationMs?: number;
}

// ── ENV var guides per auth type ─────────────────────────────────────────────

const ENV_GUIDES: Record<AuthType, { label: string; vars: { name: string; secret: boolean; example: string }[] }> = {
  none: {
    label: "No Auth",
    vars: [{ name: "FHIR_AUTH_TYPE", secret: false, example: "none" }],
  },
  bearer: {
    label: "Bearer Token (JWT / PAT)",
    vars: [
      { name: "FHIR_AUTH_TYPE",  secret: false, example: "bearer" },
      { name: "FHIR_AUTH_TOKEN", secret: true,  example: "eyJhbGciOiJIUzI1NiIs..." },
    ],
  },
  basic: {
    label: "Basic Auth",
    vars: [
      { name: "FHIR_AUTH_TYPE",     secret: false, example: "basic" },
      { name: "FHIR_AUTH_USER",     secret: false, example: "admin" },
      { name: "FHIR_AUTH_PASSWORD", secret: true,  example: "secret" },
    ],
  },
  apiKey: {
    label: "API Key",
    vars: [
      { name: "FHIR_AUTH_TYPE",             secret: false, example: "apiKey" },
      { name: "FHIR_AUTH_API_KEY_NAME",     secret: false, example: "X-Api-Key" },
      { name: "FHIR_AUTH_API_KEY_VALUE",    secret: true,  example: "my-api-key" },
      { name: "FHIR_AUTH_API_KEY_LOCATION", secret: false, example: "header  (or query)" },
    ],
  },
  oauth2: {
    label: "OAuth2 — Client Credentials (Keycloak / SMART on FHIR)",
    vars: [
      { name: "FHIR_AUTH_TYPE",          secret: false, example: "oauth2" },
      { name: "FHIR_AUTH_CLIENT_ID",     secret: false, example: "z2lab-backend" },
      { name: "FHIR_AUTH_CLIENT_SECRET", secret: true,  example: "client-secret" },
      { name: "FHIR_AUTH_TOKEN_URL",     secret: false, example: "https://keycloak/realms/z2lab/protocol/openid-connect/token" },
      { name: "FHIR_AUTH_SCOPES",        secret: false, example: "fhir/read fhir/write  (optional)" },
    ],
  },
  digest: {
    label: "Digest Auth (RFC 7616)",
    vars: [
      { name: "FHIR_AUTH_TYPE",     secret: false, example: "digest" },
      { name: "FHIR_AUTH_USER",     secret: false, example: "admin" },
      { name: "FHIR_AUTH_PASSWORD", secret: true,  example: "secret" },
    ],
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function EnvVarRow({ name, secret, example }: { name: string; secret: boolean; example: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 py-1.5 text-[12px] border-b border-zt-border last:border-0 items-start">
      <code className="font-mono font-semibold text-zt-text-primary whitespace-nowrap">{name}</code>
      <span className="text-zt-text-secondary">
        {secret
          ? <span className="italic text-zt-text-tertiary">⚠ Secret — set in ENV only, never in UI</span>
          : <span className="font-mono text-zt-text-tertiary">e.g. {example}</span>}
      </span>
    </div>
  );
}

function AuthTypeCard({ active, type, guide }: { active: boolean; type: AuthType; guide: typeof ENV_GUIDES[AuthType] }) {
  return (
    <div className={`rounded-lg border p-4 ${active ? "border-zt-primary bg-zt-primary-light" : "border-zt-border bg-zt-bg-card"}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-semibold text-zt-text-primary">{guide.label}</span>
        {active && <Badge label="Aktiv" variant="info" />}
      </div>
      <div>
        {guide.vars.map((v) => <EnvVarRow key={v.name} {...v} />)}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AuthConfigPage() {
  const { t } = useTranslation();
  const [status, setStatus]     = useState<FhirAuthStatus | null>(null);
  const [testing, setTesting]   = useState(false);
  const [testResult, setResult] = useState<TestResult | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { fhirBaseUrl?: string; fhirAuthType?: string } | null) => {
        if (d) setStatus({ authType: (d.fhirAuthType ?? "none") as AuthType, fhirBaseUrl: d.fhirBaseUrl ?? "" });
      })
      .catch(() => {});
  }, []);

  async function handleTestConnection() {
    setTesting(true);
    setResult(null);
    try {
      const start = Date.now();
      const res = await fetch("/api/fhir-health");
      const data = (await res.json()) as { ok?: boolean; message?: string };
      setResult({ ok: res.ok && !!data.ok, status: res.status, message: data.message ?? (res.ok ? "OK" : "Fehler"), durationMs: Date.now() - start });
    } catch (e: unknown) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Verbindung fehlgeschlagen" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-zt-bg-page">
      <AppSidebar />
      <main className="flex-1 p-8 max-w-4xl space-y-6">
        <BackButton />
        <div>
          <h1 className="text-xl font-semibold text-zt-text-primary">{t("authConfig.title")}</h1>
          <p className="text-[13px] text-zt-text-secondary mt-1">{t("authConfig.desc")}</p>
        </div>

        {/* Current status */}
        <Card title={t("authConfig.currentStatus")}>
          {status ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-zt-text-tertiary">FHIR Base URL</dt>
              <dd className="font-mono text-[12px] text-zt-text-secondary break-all">{status.fhirBaseUrl}</dd>
              <dt className="text-zt-text-tertiary">{t("authConfig.authType")}</dt>
              <dd><Badge label={status.authType} variant={status.authType === "none" ? "neutral" : "success"} /></dd>
            </dl>
          ) : (
            <p className="text-[13px] text-zt-text-tertiary">{t("common.loading")}</p>
          )}
          <div className="mt-4 pt-3 border-t border-zt-border flex items-center gap-3">
            <Button variant="secondary" onClick={handleTestConnection} loading={testing}>
              {t("authConfig.testConnection")}
            </Button>
            {testResult && (
              <span className={`text-[12px] font-medium ${testResult.ok ? "text-zt-success" : "text-zt-danger"}`}>
                {testResult.ok ? "✓" : "✗"} {testResult.message}
                {testResult.durationMs !== undefined && ` (${testResult.durationMs} ms)`}
              </span>
            )}
          </div>
        </Card>

        {/* Auth type reference guide */}
        <Card title={t("authConfig.reference")}>
          <p className="text-[12px] text-zt-text-tertiary mb-4">{t("authConfig.referenceDesc")}</p>
          <div className="space-y-3">
            {(Object.entries(ENV_GUIDES) as [AuthType, typeof ENV_GUIDES[AuthType]][]).map(([type, guide]) => (
              <AuthTypeCard key={type} active={status?.authType === type} type={type} guide={guide} />
            ))}
          </div>
        </Card>

        {/* Security notice */}
        <div className="flex gap-2 rounded-md border border-zt-warning-border bg-zt-warning-bg px-4 py-3 text-[12px] text-zt-warning-text">
          <span className="shrink-0 font-bold mt-0.5">⚠</span>
          <span>{t("authConfig.securityNotice")}</span>
        </div>
      </main>
    </div>
  );
}
