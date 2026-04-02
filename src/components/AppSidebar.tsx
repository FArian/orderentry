"use client";

/**
 * AppSidebar — shared left navigation column.
 * Used by DashboardPage, PatientsPage, and any other full-layout page.
 *
 * Marks the active nav item based on the current pathname.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useSession } from "@/lib/session";

// ── Nav item ──────────────────────────────────────────────────────────────────

function NavItem({
  href,
  icon,
  label,
  badge,
  activePaths,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  activePaths: string[];
}) {
  const pathname = usePathname();
  const active = activePaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
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
        <span className="bg-zt-primary text-zt-text-on-primary text-[10px] font-medium px-1.5 py-0.5 rounded-full">
          {badge}
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

// ── AppSidebar ────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const { t } = useTranslation();
  const { isAdmin } = useSession();

  return (
    <aside className="w-[220px] shrink-0 bg-zt-bg-card border-r border-zt-border flex flex-col overflow-y-auto">
      <nav className="py-5">
        {/* Navigation */}
        <div className="mb-2">
          <div className="px-4 pb-1.5 text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide">
            {t("dashboard.navSection")}
          </div>
          <NavItem href="/"         icon={IconDashboard} label={t("dashboard.title")} activePaths={["/"]} />
          <NavItem href="/patients" icon={IconPatients}  label={t("nav.patients")}   activePaths={["/patients", "/patient"]} />
          <NavItem href="/orders"   icon={IconOrders}    label={t("nav.orders")}     activePaths={["/orders"]} />
          <NavItem href="/results"  icon={IconResults}   label={t("nav.results")}    activePaths={["/results"]} />
        </div>

        {/* Account */}
        <div className="mt-4">
          <div className="px-4 pb-1.5 text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide">
            {t("dashboard.accountSection")}
          </div>
          <NavItem href="/profile" icon={IconPatients} label={t("dashboard.myProfile")} activePaths={["/profile"]} />
        </div>

        {/* Admin — only visible to users with role="admin" */}
        {isAdmin && (
          <div className="mt-4">
            <div className="px-4 pb-1.5 text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide">
              {t("nav.adminSection")}
            </div>
            <NavItem href="/admin/users" icon={IconUsers} label={t("nav.adminUsers")} activePaths={["/admin/users"]} />
            <NavItem href="/admin/roles" icon={IconRoles} label={t("nav.adminRoles")} activePaths={["/admin/roles"]} />
            <NavItem href="/admin/fhir"  icon={IconFhir}  label={t("nav.adminFhir")}  activePaths={["/admin/fhir"]}  />
            <NavItem href="/admin/api"   icon={IconApi}   label={t("nav.adminApi")}   activePaths={["/admin/api"]}   />
          </div>
        )}
      </nav>
    </aside>
  );
}
