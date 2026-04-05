"use client";

/**
 * AppSidebar — shared left navigation column.
 * Used by DashboardPage, PatientsPage, and any other full-layout page.
 *
 * Marks the active nav item based on the current pathname.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useNavCounts } from "@/presentation/hooks/useNavCounts";

interface ConnectedUrls {
  monitoringUrl:   string;
  monitoringLabel: string;
  tracingUrl:      string;
  tracingLabel:    string;
}

// ── External nav item (opens in new tab) ─────────────────────────────────────

function ExternalNavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-4 py-[9px] text-[13px] border-l-2 border-l-transparent transition-colors text-zt-text-secondary hover:bg-zt-bg-page hover:text-zt-text-primary"
    >
      <span className="w-4 h-4 shrink-0 opacity-60">{icon}</span>
      <span className="flex-1">{label}</span>
      <svg className="w-3 h-3 shrink-0 opacity-40" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7M7 1h4m0 0v4M11 1L6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </a>
  );
}

// ── Nav item ──────────────────────────────────────────────────────────────────

function NavItem({
  href,
  icon,
  label,
  badge,
  badgeVariant = "primary",
  activePaths,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeVariant?: "primary" | "warning";
  activePaths: string[];
}) {
  const pathname = usePathname();
  const active = activePaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const badgeCls = badgeVariant === "warning"
    ? "bg-zt-warning-text text-white"
    : "bg-zt-primary text-zt-text-on-primary";
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-4 py-[9px] text-[13px] border-l-2 transition-colors ${
        active
          ? "text-zt-primary bg-zt-primary-light border-l-zt-primary font-medium"
          : "text-zt-text-secondary border-l-transparent hover:bg-zt-bg-page hover:text-zt-text-primary"
      }`}
    >
      <span className={`w-4 h-4 shrink-0 ${active ? "opacity-100" : "opacity-60"}`}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`${badgeCls} text-[10px] font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center`}>
          {badge > 999 ? "999+" : badge}
        </span>
      )}
    </Link>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconDashboard = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <rect x="2" y="2" width="5" height="5" rx="1"/>
    <rect x="9" y="2" width="5" height="5" rx="1"/>
    <rect x="2" y="9" width="5" height="5" rx="1"/>
    <rect x="9" y="9" width="5" height="5" rx="1"/>
  </svg>
);

const IconPatients = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <circle cx="8" cy="5" r="3"/>
    <path d="M2 13c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
  </svg>
);

const IconOrders = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <rect x="2" y="2" width="12" height="14" rx="1"/>
    <line x1="5" y1="6"  x2="11" y2="6"  stroke="white" strokeWidth="1.5"/>
    <line x1="5" y1="9"  x2="11" y2="9"  stroke="white" strokeWidth="1.5"/>
    <line x1="5" y1="12" x2="8"  y2="12" stroke="white" strokeWidth="1.5"/>
  </svg>
);

const IconResults = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <path d="M3 3h10v2H3zM3 7h10v2H3zM3 11h6v2H3z"/>
  </svg>
);

const IconUsers = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <circle cx="6" cy="4" r="2.5"/>
    <path d="M1 13c0-2.8 2.2-5 5-5s5 2.2 5 5"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M10 13c0-1.7.9-3.2 2.2-4"/>
  </svg>
);

const IconApi = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <path d="M1 4h14v1.5H1zM1 10.5h14V12H1z"/>
    <rect x="3" y="6" width="10" height="3" rx="1"/>
  </svg>
);

const IconRoles = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <path d="M1 5h9l3 3-3 3H1V5z"/>
    <circle cx="4.5" cy="8" r="1" fill="white"/>
  </svg>
);

const IconFhir = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <rect x="2" y="2" width="5" height="5" rx="1"/>
    <rect x="9" y="2" width="5" height="5" rx="1"/>
    <path d="M4.5 7v5M4.5 12h7M11.5 7v5" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
  </svg>
);

const IconOrgs = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <rect x="2" y="6" width="12" height="8" rx="1"/>
    <rect x="5" y="2" width="6" height="5" rx="1"/>
    <rect x="6" y="9" width="1.5" height="3" fill="white"/>
    <rect x="8.5" y="9" width="1.5" height="3" fill="white"/>
  </svg>
);

const IconLogs = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <rect x="2" y="2" width="12" height="2" rx="1"/>
    <rect x="2" y="6" width="9"  height="2" rx="1"/>
    <rect x="2" y="10" width="12" height="2" rx="1"/>
    <rect x="2" y="14" width="7"  height="1.5" rx="0.75"/>
  </svg>
);

const IconTasks = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <rect x="2" y="2" width="12" height="12" rx="1.5"/>
    <path d="M5 8h6M8 5v6" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
  </svg>
);

const IconMerge = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <path d="M3 2h4v4H3zM9 2h4v4H9zM5 6v3h6V6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="5.5" y="9" width="5" height="5" rx="1"/>
  </svg>
);

const IconSettings = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <path d="M8 10a2 2 0 100-4 2 2 0 000 4z"/>
    <path fillRule="evenodd" d="M6.5 1.5l-.7 1.4a5 5 0 00-1.1.65L3.2 3.2l-1.7 3 1.1 1a5.1 5.1 0 000 1.6l-1.1 1 1.7 3 1.5-.35a5 5 0 001.1.65l.7 1.4h3l.7-1.4a5 5 0 001.1-.65l1.5.35 1.7-3-1.1-1a5.1 5.1 0 000-1.6l1.1-1-1.7-3-1.5.35a5 5 0 00-1.1-.65L9.5 1.5h-3z" clipRule="evenodd"/>
  </svg>
);

const IconMonitoring = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <rect x="1" y="2" width="14" height="10" rx="1.5"/>
    <path d="M4 9l2-3 2 2 2-4 2 3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <rect x="5" y="13" width="6" height="1.5" rx="0.75"/>
  </svg>
);

const IconAuth = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <path d="M8 1a3.5 3.5 0 00-3.5 3.5V6H3a1 1 0 00-1 1v7a1 1 0 001 1h10a1 1 0 001-1V7a1 1 0 00-1-1h-1.5V4.5A3.5 3.5 0 008 1zm-2 3.5a2 2 0 014 0V6H6V4.5zM8 10a1 1 0 110 2 1 1 0 010-2z"/>
  </svg>
);

const IconTracing = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <circle cx="3" cy="8" r="1.5"/>
    <circle cx="8" cy="4" r="1.5"/>
    <circle cx="13" cy="8" r="1.5"/>
    <circle cx="8" cy="12" r="1.5"/>
    <path d="M4.5 8h2.5M8 5.5v1M9.5 8h2M8 10.5v1" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
  </svg>
);

const IconMail = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <rect x="1" y="3" width="14" height="10" rx="1.5"/>
    <path d="M1 4.5l7 4.5 7-4.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
  </svg>
);

const IconOrgRules = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <rect x="1" y="2" width="14" height="3" rx="1"/>
    <rect x="1" y="7" width="9"  height="3" rx="1"/>
    <rect x="1" y="12" width="6"  height="2" rx="1"/>
    <path d="M12 8l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const IconNumberPool = (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
    <rect x="1" y="1" width="6" height="6" rx="1"/>
    <rect x="9" y="1" width="6" height="6" rx="1"/>
    <rect x="1" y="9" width="6" height="6" rx="1"/>
    <rect x="9" y="9" width="6" height="6" rx="1"/>
  </svg>
);

// ── AppSidebar ────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const { t } = useTranslation();
  const { isAdmin, user, status } = useSession();
  const counts = useNavCounts(status === "authenticated");
  const [connectedUrls, setConnectedUrls] = useState<ConnectedUrls | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { monitoringUrl?: string; monitoringLabel?: string; tracingUrl?: string; tracingLabel?: string } | null) => {
        if (d) setConnectedUrls({
          monitoringUrl:   d.monitoringUrl   ?? "",
          monitoringLabel: d.monitoringLabel ?? "",
          tracingUrl:      d.tracingUrl      ?? "",
          tracingLabel:    d.tracingLabel    ?? "",
        });
      })
      .catch(() => {});
  }, []);

  return (
    <aside className="w-[220px] shrink-0 bg-zt-bg-card border-r border-zt-border flex flex-col overflow-y-auto">
      <nav className="py-5">
        {/* Navigation */}
        <div className="mb-2">
          <div className="px-4 pb-1.5 text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide">
            {t("dashboard.navSection")}
          </div>
          <NavItem href="/"         icon={IconDashboard} label={t("dashboard.title")} activePaths={["/"]} />
          <NavItem href="/patients" icon={IconPatients}  label={t("nav.patients")}   activePaths={["/patients", "/patient"]} {...(counts.patients !== null && { badge: counts.patients })} />
          <NavItem href="/orders"   icon={IconOrders}    label={t("nav.orders")}     activePaths={["/orders"]}               {...(counts.orders   !== null && { badge: counts.orders })} />
          <NavItem href="/results"  icon={IconResults}   label={t("nav.results")}    activePaths={["/results"]}              {...(counts.results  !== null && { badge: counts.results })} />
        </div>

        {/* Account */}
        <div className="mt-4">
          <div className="px-4 pb-1.5 text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide">
            {t("dashboard.accountSection")}
          </div>
          <NavItem href="/profile"        icon={IconPatients}  label={t("dashboard.myProfile")} activePaths={["/profile"]} />
          <NavItem href="/settings"       icon={IconSettings}  label={t("nav.settings")}        activePaths={["/settings"]} />
          <NavItem href="/account/system" icon={IconFhir}      label={t("nav.accountSystem")}   activePaths={["/account/system"]} />
        </div>

        {/* Admin — only visible to users with role="admin" */}
        {isAdmin && (
          <div className="mt-4">
            <div className="px-4 pb-1.5 text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide">
              {t("nav.adminSection")}
            </div>
            {counts.tasks !== null && counts.tasks > 0 && (
              <NavItem href="/admin/tasks" icon={IconTasks} label={t("nav.adminTasks")} activePaths={["/admin/tasks"]} badge={counts.tasks} badgeVariant="warning" />
            )}
            {counts.mergeCount !== null && counts.mergeCount > 0 && (
              <NavItem href="/admin/merge" icon={IconMerge} label={t("nav.adminMerge")} activePaths={["/admin/merge"]} badge={counts.mergeCount} badgeVariant="warning" />
            )}
            <NavItem href="/admin/users"         icon={IconUsers} label={t("nav.adminUsers")} activePaths={["/admin/users"]} {...(counts.users    !== null && { badge: counts.users })} />
            <NavItem href="/admin/roles"         icon={IconRoles} label={t("nav.adminRoles")} activePaths={["/admin/roles"]} {...(counts.roles    !== null && { badge: counts.roles })} />
            <NavItem href="/admin/organizations" icon={IconOrgs}  label={t("nav.adminOrgs")}  activePaths={["/admin/organizations"]} {...(counts.fhirOrgs !== null && { badge: counts.fhirOrgs })} />
            <NavItem href="/admin/auth-config"   icon={IconAuth}  label={t("nav.adminAuthConfig")} activePaths={["/admin/auth-config"]} />
            <NavItem href="/settings/mail"        icon={IconMail}       label={t("nav.mailConfig")}       activePaths={["/settings/mail"]} />
            <NavItem href="/admin/org-rules"      icon={IconOrgRules}   label={t("nav.adminOrgRules")}    activePaths={["/admin/org-rules"]} />
            <NavItem href="/admin/number-pool"    icon={IconNumberPool} label={t("nav.adminNumberPool")}  activePaths={["/admin/number-pool"]} />
            <NavItem href="/admin/env"           icon={IconSettings}   label={t("nav.adminEnv")}         activePaths={["/admin/env"]}  />
            <NavItem href="/admin/fhir"          icon={IconFhir}  label={t("nav.adminFhir")}  activePaths={["/admin/fhir"]}  />
            <NavItem href="/admin/api"           icon={IconApi}   label={t("nav.adminApi")}   activePaths={["/admin/api"]}   />
            <NavItem href="/admin/logs"          icon={IconLogs}  label={t("nav.adminLogs")}  activePaths={["/admin/logs"]}  />
          </div>
        )}
        {/* Verbundene Systeme — nur wenn mindestens eine URL konfiguriert ist */}
        {connectedUrls && (connectedUrls.monitoringUrl || connectedUrls.tracingUrl) && (
          <div className="mt-4">
            <div className="px-4 pb-1.5 text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide">
              {t("nav.connectedSection")}
            </div>
            {connectedUrls.monitoringUrl && (
              <ExternalNavItem
                href={connectedUrls.monitoringUrl}
                icon={IconMonitoring}
                label={connectedUrls.monitoringLabel || t("system.monitoringSystem")}
              />
            )}
            {connectedUrls.tracingUrl && (
              <ExternalNavItem
                href={connectedUrls.tracingUrl}
                icon={IconTracing}
                label={connectedUrls.tracingLabel || t("system.tracingSystem")}
              />
            )}
            <Link
              href="/settings"
              className="flex items-center gap-1.5 px-4 py-2 text-[11px] text-zt-text-tertiary hover:text-zt-primary transition-colors"
            >
              <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3 shrink-0" aria-hidden="true">
                <path d="M6 7.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                <path fillRule="evenodd" d="M4.9 1l-.5 1.05a4 4 0 00-.8.47L2.5 2.2 1.2 4.4l.83.75a4 4 0 000 1.7L1.2 7.6 2.5 9.8l1.1-.32c.25.18.52.34.8.47L4.9 11h2.2l.5-1.05c.28-.13.55-.29.8-.47l1.1.32 1.3-2.2-.83-.75a4 4 0 000-1.7l.83-.75L9.5 2.2 8.4 2.52a4 4 0 00-.8-.47L7.1 1H4.9z" clipRule="evenodd"/>
              </svg>
              {t("system.configureConnections")}
            </Link>
          </div>
        )}
      </nav>

      {/* No-org warning banner */}
      {user && !user.hasOrgAccess && (
        <div className="mx-3 mb-4 p-3 bg-zt-warning-bg border border-zt-warning-border rounded-md text-[12px]">
          <p className="font-medium text-zt-warning-text">{t("auth.noOrgAccessTitle")}</p>
          <p className="text-zt-warning-text mt-0.5 opacity-80">{t("auth.noOrgAccessDesc")}</p>
        </div>
      )}
    </aside>
  );
}
