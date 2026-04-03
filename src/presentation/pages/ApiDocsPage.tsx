"use client";

/**
 * ApiDocsPage — Admin → API documentation page.
 *
 * Provides:
 *   - Live Swagger UI (link + embedded iframe)
 *   - API overview (base URL, endpoint catalogue)
 *   - Authentication guide
 *   - cURL connection examples
 *   - FHIR integration flow
 *   - WADL download link
 */

import Link from "next/link";
import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { useTranslation } from "@/lib/i18n";

// ── Small layout helpers ───────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-zt-bg-card border border-zt-border rounded-xl p-6 mb-5">
      <h2 className="text-[15px] font-semibold text-zt-text-primary mb-4">{title}</h2>
      {children}
    </section>
  );
}

function CodeBlock({ children, lang = "bash" }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative group">
      <pre className={`language-${lang} bg-[#1e1e2e] text-[#cdd6f4] text-[12px] font-mono rounded-lg p-4 overflow-x-auto leading-relaxed`}>
        <code>{children}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 text-white text-[10px] px-2 py-1 rounded"
      >
        {copied ? "Kopiert" : "Kopieren"}
      </button>
    </div>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color: Record<string, string> = {
    GET:    "bg-zt-primary/10 text-zt-primary border-zt-primary/20",
    POST:   "bg-zt-success-light text-zt-success border-zt-success-border",
    PUT:    "bg-zt-warning-bg text-zt-warning-text border-zt-warning-text/20",
    DELETE: "bg-zt-danger-light text-zt-danger border-zt-danger-border",
  };
  return (
    <tr className="border-b border-zt-border last:border-0 hover:bg-zt-bg-page/50 transition-colors">
      <td className="py-2.5 pr-3 pl-4 w-20">
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${color[method] ?? "bg-zt-bg-muted text-zt-text-secondary border-zt-border"}`}>
          {method}
        </span>
      </td>
      <td className="py-2.5 pr-4 font-mono text-[12px] text-zt-text-primary">{path}</td>
      <td className="py-2.5 pr-4 text-[12px] text-zt-text-secondary">{desc}</td>
    </tr>
  );
}

// ── Endpoint catalogue (mirrors OpenAPI spec) ──────────────────────────────────

const ENDPOINTS = [
  // Auth
  { method: "POST",   path: "/api/login",                           desc: "Anmelden — setzt signiertes Session-Cookie",                          group: "Auth" },
  { method: "POST",   path: "/api/logout",                          desc: "Abmelden — löscht Session-Cookie",                                    group: "Auth" },
  { method: "GET",    path: "/api/me",                              desc: "Aktueller Benutzer (aus Session)",                                    group: "Auth" },
  // Results
  { method: "GET",    path: "/api/diagnostic-reports",              desc: "DiagnosticReport-Liste (Befunde) — paginiert, gefiltert",             group: "Befunde" },
  // Orders
  { method: "GET",    path: "/api/service-requests",                desc: "ServiceRequest-Liste (Aufträge) — letzte 50",                        group: "Aufträge" },
  { method: "GET",    path: "/api/service-requests/{id}",           desc: "Einzelner ServiceRequest (FHIR-Ressource)",                           group: "Aufträge" },
  { method: "PUT",    path: "/api/service-requests/{id}",           desc: "ServiceRequest aktualisieren (PUT)",                                  group: "Aufträge" },
  { method: "DELETE", path: "/api/service-requests/{id}",           desc: "ServiceRequest löschen (Hard oder Soft-Delete)",                      group: "Aufträge" },
  // Patients
  { method: "GET",    path: "/api/patients",                        desc: "Patienten suchen — paginiert, nach Name",                            group: "Patienten" },
  { method: "GET",    path: "/api/patients/{id}",                   desc: "Patient nach ID (FHIR-Ressource)",                                    group: "Patienten" },
  { method: "PUT",    path: "/api/patients/{id}",                   desc: "Versicherungsidentifikatoren aktualisieren",                          group: "Patienten" },
  { method: "GET",    path: "/api/patients/{id}/service-requests",  desc: "Aufträge eines Patienten",                                            group: "Patienten" },
  { method: "GET",    path: "/api/patients/{id}/diagnostic-reports",desc: "Befunde eines Patienten",                                             group: "Patienten" },
  // Users (Admin)
  { method: "GET",    path: "/api/users",                           desc: "Benutzerliste (Admin) — paginiert, gefiltert",                       group: "Benutzer (Admin)" },
  { method: "POST",   path: "/api/users",                           desc: "Benutzer erstellen (Admin)",                                          group: "Benutzer (Admin)" },
  { method: "GET",    path: "/api/users/{id}",                      desc: "Benutzer nach ID (Admin)",                                            group: "Benutzer (Admin)" },
  { method: "PUT",    path: "/api/users/{id}",                      desc: "Benutzer aktualisieren: Rolle, Status, Profil (Admin)",               group: "Benutzer (Admin)" },
  { method: "DELETE", path: "/api/users/{id}",                      desc: "Benutzer löschen (Admin)",                                            group: "Benutzer (Admin)" },
  { method: "POST",   path: "/api/users/{id}/sync",                 desc: "FHIR-Sync: Practitioner + PractitionerRole + Organization (Admin)",  group: "Benutzer (Admin)" },
];

const GROUPS = Array.from(new Set(ENDPOINTS.map((e) => e.group)));

// ── ApiDocsPage ────────────────────────────────────────────────────────────────

export function ApiDocsPage() {
  const { t } = useTranslation();
  const [swaggerOpen, setSwaggerOpen] = useState(false);

  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />

      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[1100px] mx-auto">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary mb-4">
            <BackButton />
            <span className="text-zt-text-tertiary">|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("apiPage.title")}</span>
          </nav>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[20px] font-medium text-zt-text-primary">{t("apiPage.title")}</h1>
              <p className="text-[13px] text-zt-text-secondary mt-0.5">{t("apiPage.subtitle")}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/openapi.json"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] px-3 py-1.5 rounded-lg border border-zt-border text-zt-text-secondary hover:text-zt-text-primary hover:bg-zt-bg-card transition-colors"
              >
                OpenAPI JSON
              </a>
              <a
                href="/api/application.wadl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] px-3 py-1.5 rounded-lg border border-zt-border text-zt-text-secondary hover:text-zt-text-primary hover:bg-zt-bg-card transition-colors"
              >
                WADL
              </a>
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] px-3.5 py-1.5 rounded-lg bg-zt-primary text-zt-text-on-primary hover:bg-zt-primary/90 transition-colors"
              >
                Swagger UI ↗
              </a>
            </div>
          </div>

          {/* ── Section 1: Swagger UI ─────────────────────────────────── */}
          <Section title={t("apiPage.swaggerTitle")}>
            <p className="text-[13px] text-zt-text-secondary mb-4">{t("apiPage.swaggerDesc")}</p>
            <button
              onClick={() => setSwaggerOpen((v) => !v)}
              className="flex items-center gap-2 text-[13px] px-4 py-2 rounded-lg border border-zt-border hover:bg-zt-bg-page transition-colors text-zt-text-primary mb-4"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                {swaggerOpen
                  ? <path d="M3 5h10l-5 7z"/>
                  : <path d="M5 3v10l7-5z"/>}
              </svg>
              {swaggerOpen ? t("apiPage.swaggerHide") : t("apiPage.swaggerShow")}
            </button>
            {swaggerOpen && (
              <div className="rounded-xl overflow-hidden border border-zt-border" style={{ height: 600 }}>
                <iframe
                  src="/api/docs"
                  className="w-full h-full border-0"
                  title="Swagger UI"
                  loading="lazy"
                />
              </div>
            )}
            {!swaggerOpen && (
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] text-zt-primary hover:underline"
              >
                {t("apiPage.swaggerOpen")} ↗
              </a>
            )}
          </Section>

          {/* ── Section 2: API Overview ───────────────────────────────── */}
          <Section title={t("apiPage.overviewTitle")}>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-zt-bg-page rounded-lg p-3.5 border border-zt-border">
                <div className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide mb-1">{t("apiPage.baseUrl")}</div>
                <code className="text-[13px] font-mono text-zt-primary">/api</code>
              </div>
              <div className="bg-zt-bg-page rounded-lg p-3.5 border border-zt-border">
                <div className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide mb-1">{t("apiPage.contentType")}</div>
                <code className="text-[13px] font-mono text-zt-text-primary">application/json</code>
              </div>
            </div>

            {GROUPS.map((group) => (
              <div key={group} className="mb-4">
                <div className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide mb-2">{group}</div>
                <div className="rounded-lg border border-zt-border overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {ENDPOINTS.filter((e) => e.group === group).map((e) => (
                        <EndpointRow key={e.method + e.path} method={e.method} path={e.path} desc={e.desc} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </Section>

          {/* ── Section 3: Authentication ─────────────────────────────── */}
          <Section title={t("apiPage.authTitle")}>
            <p className="text-[13px] text-zt-text-secondary mb-4">{t("apiPage.authDesc")}</p>

            <div className="space-y-4">
              <div>
                <div className="text-[12px] font-medium text-zt-text-primary mb-2">1. {t("apiPage.authStep1")}</div>
                <CodeBlock lang="bash">{`curl -X POST https://<host>/api/login \\
  -H "Content-Type: application/json" \\
  -d '{"username": "admin", "password": "••••••••"}' \\
  -c cookies.txt`}</CodeBlock>
              </div>

              <div>
                <div className="text-[12px] font-medium text-zt-text-primary mb-2">2. {t("apiPage.authStep2")}</div>
                <CodeBlock lang="bash">{`# Das Cookie wird automatisch mitgesendet wenn -b cookies.txt verwendet wird
curl -X GET https://<host>/api/me \\
  -b cookies.txt`}</CodeBlock>
              </div>

              <div className="bg-zt-warning-bg border border-zt-warning-text/20 rounded-lg p-3.5">
                <div className="text-[12px] font-medium text-zt-warning-text mb-1">{t("apiPage.authNote")}</div>
                <p className="text-[12px] text-zt-warning-text/80">{t("apiPage.authNoteDesc")}</p>
              </div>
            </div>
          </Section>

          {/* ── Section 4: Connection Guide ───────────────────────────── */}
          <Section title={t("apiPage.connectTitle")}>
            <p className="text-[13px] text-zt-text-secondary mb-5">{t("apiPage.connectDesc")}</p>

            <div className="space-y-5">
              <div>
                <div className="text-[12px] font-semibold text-zt-text-primary mb-2">{t("apiPage.exampleListUsers")}</div>
                <CodeBlock lang="bash">{`curl -X GET "https://<host>/api/users?page=1&pageSize=20" \\
  -b cookies.txt \\
  -H "Accept: application/json"`}</CodeBlock>
              </div>

              <div>
                <div className="text-[12px] font-semibold text-zt-text-primary mb-2">{t("apiPage.exampleCreateUser")}</div>
                <CodeBlock lang="bash">{`curl -X POST https://<host>/api/users \\
  -b cookies.txt \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "dr.mueller",
    "password": "sicher!2024",
    "providerType": "local",
    "role": "user",
    "profile": {
      "ptype": "NAT",
      "firstName": "Hans",
      "lastName": "Müller",
      "gln": "7601002145985"
    }
  }'`}</CodeBlock>
              </div>

              <div>
                <div className="text-[12px] font-semibold text-zt-text-primary mb-2">{t("apiPage.exampleSyncFhir")}</div>
                <CodeBlock lang="bash">{`# FHIR-Sync eines Benutzers (erstellt Practitioner + PractitionerRole + Organization)
curl -X POST https://<host>/api/users/<id>/sync \\
  -b cookies.txt`}</CodeBlock>
              </div>

              <div>
                <div className="text-[12px] font-semibold text-zt-text-primary mb-2">{t("apiPage.exampleListResults")}</div>
                <CodeBlock lang="bash">{`curl -X GET "https://<host>/api/diagnostic-reports?patientId=p-123&status=final" \\
  -b cookies.txt`}</CodeBlock>
              </div>
            </div>
          </Section>

          {/* ── Section 5: FHIR Integration ───────────────────────────── */}
          <Section title={t("apiPage.fhirTitle")}>
            <p className="text-[13px] text-zt-text-secondary mb-5">{t("apiPage.fhirDesc")}</p>

            {/* Flow diagram */}
            <div className="bg-zt-bg-page rounded-xl border border-zt-border p-5 mb-5">
              <div className="flex items-center gap-0 overflow-x-auto">
                {[
                  { label: "Client", sub: "Browser / PIS / LDAP", color: "bg-zt-primary-light border-zt-primary text-zt-primary" },
                  { label: "→", sub: "", color: "" },
                  { label: "OrderEntry API", sub: "Next.js /api/*", color: "bg-zt-bg-card border-zt-border text-zt-text-primary" },
                  { label: "→", sub: "", color: "" },
                  { label: "FHIR Bundle", sub: "Transaction", color: "bg-zt-bg-card border-zt-border text-zt-text-primary" },
                  { label: "→", sub: "", color: "" },
                  { label: "HAPI FHIR", sub: "R4 Server", color: "bg-zt-success-light border-zt-success-border text-zt-success" },
                ].map((step, i) =>
                  step.label === "→" ? (
                    <div key={i} className="text-zt-text-tertiary text-[18px] px-2 shrink-0">→</div>
                  ) : (
                    <div key={i} className={`shrink-0 rounded-lg border px-4 py-3 text-center ${step.color}`}>
                      <div className="text-[13px] font-semibold">{step.label}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{step.sub}</div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: t("apiPage.fhirMapUser"),
                  items: ["User → Practitioner", "User.profile.gln → Practitioner.identifier", "User.profile.firstName/lastName → Practitioner.name"],
                },
                {
                  title: t("apiPage.fhirMapRole"),
                  items: ["User.role → PractitionerRole.code", "User.profile.orgGln → PractitionerRole.organization", "PractitionerRole.practitioner → Practitioner"],
                },
                {
                  title: t("apiPage.fhirMapOrg"),
                  items: ["User.profile.organization → Organization.name", "User.profile.orgGln → Organization.identifier", "ptype=JUR → Organization.partOf"],
                },
              ].map((card) => (
                <div key={card.title} className="bg-zt-bg-page rounded-lg border border-zt-border p-4">
                  <div className="text-[12px] font-semibold text-zt-text-primary mb-3">{card.title}</div>
                  <ul className="space-y-1.5">
                    {card.items.map((item) => (
                      <li key={item} className="text-[11px] text-zt-text-secondary flex items-start gap-1.5">
                        <span className="text-zt-primary mt-0.5">›</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Section 6: WADL ───────────────────────────────────────── */}
          <Section title={t("apiPage.wadlTitle")}>
            <p className="text-[13px] text-zt-text-secondary mb-4">{t("apiPage.wadlDesc")}</p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/api/application.wadl"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-lg border border-zt-border text-zt-text-primary hover:bg-zt-bg-page transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 12L3 7h3V2h4v5h3z"/>
                  <path d="M2 14h12v-1H2z"/>
                </svg>
                {t("apiPage.wadlDownload")}
              </a>
              <a
                href="/api/openapi.json"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-lg border border-zt-border text-zt-text-secondary hover:text-zt-text-primary hover:bg-zt-bg-page transition-colors"
              >
                OpenAPI 3.0 JSON ↗
              </a>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
