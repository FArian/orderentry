"use client";

/**
 * /account/system — Organisation assignment status + connected external systems.
 *
 * Users see their org info (read-only).
 * Admins see the same view — full org editing is in /admin/users.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { useTranslation } from "@/lib/i18n";
import { useSession } from "@/lib/session";

interface ServerInfo {
  fhirBaseUrl:     string;
  monitoringUrl:   string;
  monitoringLabel: string;
  tracingUrl:      string;
  tracingLabel:    string;
  mailProvider:    string;
  mailAuthType:    string;
  mailFrom:        string;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconOrg = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path d="M4 4h12v12H4z" opacity="0.15"/>
    <path fillRule="evenodd" d="M2 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2 0v12h12V4H4zm3 3h2v2H7V7zm0 4h2v2H7v-2zm4-4h2v2h-2V7zm0 4h2v2h-2v-2z" clipRule="evenodd"/>
  </svg>
);

// ── SystemStatusRow ───────────────────────────────────────────────────────────

function SystemStatusRow({
  label,
  url,
  configuredLabel,
  notConfiguredLabel,
  openLabel,
}: {
  label: string;
  url: string;
  configuredLabel: string;
  notConfiguredLabel: string;
  openLabel: string;
}) {
  const isConfigured = !!url;
  return (
    <div className="flex items-center gap-4 py-3 border-b border-zt-border last:border-0">
      <span className="w-40 shrink-0 text-[13px] text-zt-text-secondary">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`inline-flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-full ${
          isConfigured
            ? "bg-zt-success-light text-zt-success border border-zt-success-border"
            : "bg-zt-bg-muted text-zt-text-tertiary border border-zt-border"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? "bg-zt-success" : "bg-zt-text-disabled"}`} />
          {isConfigured ? configuredLabel : notConfiguredLabel}
        </span>
        {isConfigured && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-zt-primary hover:underline truncate"
          >
            {openLabel} ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── MailStatusRow ─────────────────────────────────────────────────────────────

function MailStatusRow({
  provider, authType, from, label, configuredLabel, notConfiguredLabel,
}: {
  provider: string; authType: string; from: string;
  label: string; configuredLabel: string; notConfiguredLabel: string;
}) {
  const isConfigured = !!provider;
  return (
    <div className="flex items-center gap-4 py-3 border-b border-zt-border last:border-0">
      <span className="w-40 shrink-0 text-[13px] text-zt-text-secondary">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-full ${
          isConfigured
            ? "bg-zt-success-light text-zt-success border border-zt-success-border"
            : "bg-zt-bg-muted text-zt-text-tertiary border border-zt-border"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? "bg-zt-success" : "bg-zt-text-disabled"}`} />
          {isConfigured ? configuredLabel : notConfiguredLabel}
        </span>
        {isConfigured && (
          <span className="text-[11px] text-zt-text-tertiary font-mono truncate">
            {provider} · {authType}{from && ` · ${from}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ── StatusRow ─────────────────────────────────────────────────────────────────

function StatusRow({ label, value, missing }: { label: string; value?: string | undefined; missing?: string | undefined }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-zt-border last:border-0">
      <span className="w-40 shrink-0 text-[13px] text-zt-text-secondary">{label}</span>
      <span className={`text-[13px] ${value ? "text-zt-text-primary font-medium" : "text-zt-text-tertiary italic"}`}>
        {value ?? missing}
      </span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AccountSystemPage() {
  const { t } = useTranslation();
  const { user, status } = useSession();
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d: ServerInfo | null) => { if (d) setServerInfo(d); })
      .catch(() => {});
  }, []);

  const isLoading = status === "loading";

  return (
    <div className="flex min-h-screen bg-zt-bg-page">
      <AppSidebar />

      <main className="flex-1 p-8 max-w-3xl">
        <div className="mb-4">
          <BackButton />
        </div>
        <h1 className="text-xl font-semibold text-zt-text-primary mb-1">
          {t("nav.accountSystem")}
        </h1>
        <p className="text-[13px] text-zt-text-secondary mb-6">
          {t("system.orgAssignmentDesc")}
        </p>

        {/* Organisation card */}
        <div className="bg-zt-bg-card border border-zt-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-zt-border bg-zt-bg-muted">
            <span className="text-zt-text-secondary">{IconOrg}</span>
            <h2 className="text-[14px] font-medium text-zt-text-primary">
              {t("system.orgSection")}
            </h2>
          </div>

          <div className="px-5">
            {isLoading ? (
              <div className="py-6 text-[13px] text-zt-text-tertiary">{t("common.loading")}</div>
            ) : (
              <>
                <StatusRow
                  label={t("system.orgName")}
                  value={user?.orgName}
                  missing={t("system.notAssigned")}
                />
                <StatusRow
                  label={t("system.orgGln")}
                  value={user?.orgGln}
                  missing={t("system.notAssigned")}
                />
                <StatusRow
                  label={t("system.orgFhirId")}
                  value={user?.orgFhirId}
                  missing={t("system.notSynced")}
                />
                <StatusRow
                  label={t("system.accessStatus")}
                  value={user?.hasOrgAccess ? t("system.accessGranted") : undefined}
                  missing={t("system.accessDenied")}
                />
              </>
            )}
          </div>
        </div>

        {/* Verbundene Systeme */}
        <div className="mt-6 bg-zt-bg-card border border-zt-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-zt-border bg-zt-bg-muted">
            <span className="text-zt-text-secondary">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4zm-1 9V9l5 2.5-5 2.5z"/>
              </svg>
            </span>
            <h2 className="text-[14px] font-medium text-zt-text-primary">
              {t("system.connectedSystems")}
            </h2>
          </div>
          <div className="px-5">
            {serverInfo ? (
              <>
                <SystemStatusRow
                  label={t("system.fhirServer")}
                  url={serverInfo.fhirBaseUrl}
                  configuredLabel={t("system.statusConfigured")}
                  notConfiguredLabel={t("system.statusNotConfigured")}
                  openLabel={t("system.openSystem")}
                />
                <SystemStatusRow
                  label={serverInfo.monitoringLabel || t("system.monitoringSystem")}
                  url={serverInfo.monitoringUrl}
                  configuredLabel={t("system.statusConfigured")}
                  notConfiguredLabel={t("system.statusNotConfigured")}
                  openLabel={t("system.openSystem")}
                />
                <SystemStatusRow
                  label={serverInfo.tracingLabel || t("system.tracingSystem")}
                  url={serverInfo.tracingUrl}
                  configuredLabel={t("system.statusConfigured")}
                  notConfiguredLabel={t("system.statusNotConfigured")}
                  openLabel={t("system.openSystem")}
                />
                <MailStatusRow
                  provider={serverInfo.mailProvider}
                  authType={serverInfo.mailAuthType}
                  from={serverInfo.mailFrom}
                  configuredLabel={t("system.statusConfigured")}
                  notConfiguredLabel={t("system.statusNotConfigured")}
                  label={t("system.mailServer")}
                />
              </>
            ) : (
              <div className="py-6 text-[13px] text-zt-text-tertiary">{t("common.loading")}</div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-zt-border bg-zt-bg-muted flex justify-end">
            <Link
              href="/settings"
              className="flex items-center gap-1.5 text-[12px] text-zt-primary hover:underline font-medium"
            >
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                <path d="M7 9a2 2 0 100-4 2 2 0 000 4z"/>
                <path fillRule="evenodd" d="M5.6 1.2l-.6 1.2a5 5 0 00-.95.55L2.8 2.6 1.2 5.4l1 .9a5.1 5.1 0 000 1.4l-1 .9 1.6 2.8 1.25-.35c.3.22.62.4.95.55l.6 1.2h2.8l.6-1.2c.33-.15.65-.33.95-.55l1.25.35 1.6-2.8-1-.9a5.1 5.1 0 000-1.4l1-.9-1.6-2.8-1.25.35A5 5 0 008.4 2.4L7.8 1.2H5.6z" clipRule="evenodd"/>
              </svg>
              {t("system.configureConnections")} →
            </Link>
          </div>
        </div>

        {/* No-org warning */}
        {!isLoading && user && !user.hasOrgAccess && (
          <div className="mt-4 p-4 bg-zt-warning-bg border border-zt-warning-border rounded-lg">
            <p className="text-[13px] font-medium text-zt-warning-text">{t("auth.noOrgAccessTitle")}</p>
            <p className="text-[13px] text-zt-warning-text mt-1 opacity-80">{t("auth.noOrgAccessDesc")}</p>
          </div>
        )}

        {/* Admin hint */}
        {!isLoading && user?.role === "admin" && (
          <p className="mt-4 text-[12px] text-zt-text-tertiary">
            {t("system.adminHint")}
          </p>
        )}
      </main>
    </div>
  );
}
