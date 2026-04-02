"use client";

/**
 * DashboardPage — main overview screen after login.
 *
 * Layout (matches design/dashboard.html exactly):
 *   Sidebar (220px)  |  Content area (flex-1)
 *
 * Data:
 *   Fetches /api/me, /api/patients, /api/service-requests,
 *   /api/diagnostic-reports on mount to populate stats and
 *   recent-item lists.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/shared/utils/formatDate";
import { AppSidebar } from "@/components/AppSidebar";
import type { OrderResponseDto } from "@/infrastructure/api/dto/OrderDto";
import type { PatientResponseDto } from "@/infrastructure/api/dto/PatientDto";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardStats {
  patients: number;
  orders: number;
  drafts: number;
  results: number;
  sentToday: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate()
  );
}

function orderStatusPill(status: string): string {
  if (status === "draft")     return "bg-[#FAEEDA] text-[#854F0B]";
  if (status === "active")    return "bg-zt-primary-light text-zt-primary";
  if (status === "completed") return "bg-zt-success-light text-zt-success";
  return "bg-zt-bg-page text-zt-text-secondary";
}

function orderStatusLabel(status: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    draft:     t("orders.statusDraft"),
    active:    t("orders.statusActive"),
    completed: t("orders.statusCompleted"),
    revoked:   t("orders.statusRevoked"),
    "on-hold": t("orders.statusOnHold"),
    "entered-in-error": t("orders.statusError"),
  };
  return map[status] ?? t("orders.statusUnknown");
}

function formatOrderDate(dateStr: string): string {
  if (!dateStr) return "";
  if (isToday(dateStr)) return "Heute";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  subVariant = "default",
}: {
  label: string;
  value: number | string;
  sub: string;
  subVariant?: "default" | "up" | "warn";
}) {
  const subColor =
    subVariant === "up"   ? "text-zt-success" :
    subVariant === "warn" ? "text-[#854F0B]"  :
    "text-zt-text-tertiary";

  return (
    <div className="bg-zt-bg-muted rounded-xl px-4 py-3.5">
      <div className="text-xs text-zt-text-secondary mb-1.5">{label}</div>
      <div className="text-2xl font-medium text-zt-text-primary">{value}</div>
      <div className={`text-[11px] mt-1 ${subColor}`}>{sub}</div>
    </div>
  );
}

// ── Alert item ────────────────────────────────────────────────────────────────

function AlertItem({
  variant,
  text,
  time,
}: {
  variant: "warn" | "info" | "success";
  text: string;
  time: string;
}) {
  const styles = {
    warn:    { wrap: "bg-[#FAEEDA] border-l-[3px] border-l-[#854F0B]", dot: "bg-[#854F0B]" },
    info:    { wrap: "bg-zt-primary-light border-l-[3px] border-l-zt-primary", dot: "bg-zt-primary" },
    success: { wrap: "bg-zt-success-light border-l-[3px] border-l-zt-success", dot: "bg-zt-success" },
  }[variant];

  return (
    <div className={`flex gap-2.5 px-3 py-2.5 rounded-lg ${styles.wrap}`}>
      <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${styles.dot}`} aria-hidden="true" />
      <div>
        <div className="text-xs text-zt-text-primary leading-snug">{text}</div>
        <div className="text-[11px] text-zt-text-tertiary mt-0.5">{time}</div>
      </div>
    </div>
  );
}

// ── DashboardPage ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [username, setUsername]               = useState("");
  const [stats, setStats]                     = useState<DashboardStats>({ patients: 0, orders: 0, drafts: 0, results: 0, sentToday: 0 });
  const [recentOrders, setRecentOrders]       = useState<OrderResponseDto[]>([]);
  const [recentPatients, setRecentPatients]   = useState<PatientResponseDto[]>([]);
  const [patientSearch, setPatientSearch]     = useState("");
  const [loading, setLoading]                 = useState(true);

  // ── Today label ─────────────────────────────────────────────────────────────
  const todayLabel = (() => {
    const d = new Date();
    return d.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  })();

  // ── Fetch dashboard data ─────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoading(true);

    async function load() {
      try {
        const [meRes, patientsRes, ordersRes, resultsRes] = await Promise.allSettled([
          fetch("/api/me", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/patients?pageSize=5", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/service-requests?pageSize=6", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/diagnostic-reports?pageSize=1", { cache: "no-store" }).then((r) => r.json()),
        ]);

        if (!active) return;

        // User
        if (meRes.status === "fulfilled" && meRes.value?.user?.username) {
          setUsername(meRes.value.user.username as string);
        }

        // Patients
        const patientsData =
          patientsRes.status === "fulfilled" ? patientsRes.value : null;
        const patientsTotal: number = patientsData?.total ?? 0;
        const recentPats: PatientResponseDto[] = patientsData?.data?.slice(0, 3) ?? [];
        setRecentPatients(recentPats);

        // Orders
        const ordersData =
          ordersRes.status === "fulfilled" ? ordersRes.value : null;
        const ordersTotal: number = ordersData?.total ?? 0;
        const allOrders: OrderResponseDto[] = ordersData?.data ?? [];
        const draftsCount = allOrders.filter((o) => o.status === "draft").length;
        const sentTodayCount = allOrders.filter(
          (o) => o.status === "active" && isToday(o.authoredOn)
        ).length;
        setRecentOrders(allOrders.slice(0, 5));

        // Results
        const resultsData =
          resultsRes.status === "fulfilled" ? resultsRes.value : null;
        const resultsTotal: number = resultsData?.total ?? 0;

        setStats({
          patients: patientsTotal,
          orders:   ordersTotal,
          drafts:   draftsCount,
          results:  resultsTotal,
          sentToday: sentTodayCount,
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, []);

  // ── Patient quick search ─────────────────────────────────────────────────────
  function handlePatientSearch(value: string) {
    setPatientSearch(value);
  }

  function submitPatientSearch() {
    const q = patientSearch.trim();
    if (q) {
      router.push(`/patient?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/patient");
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - var(--zt-topbar-height))" }}>

      <AppSidebar />

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-8 py-7">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-medium text-zt-text-primary">{t("dashboard.title")}</h1>
          <p className="text-[13px] text-zt-text-secondary mt-0.5">
            {t("dashboard.greeting")}{username ? `, ${username}` : ""} — {todayLabel}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard
            label={t("dashboard.statPatients")}
            value={loading ? "—" : stats.patients}
            sub={t("dashboard.activeToday")}
            subVariant="up"
          />
          <StatCard
            label={t("dashboard.statOrders")}
            value={loading ? "—" : stats.orders}
            sub={`${stats.drafts} ${t("dashboard.draftsPending")}`}
            subVariant={stats.drafts > 0 ? "warn" : "default"}
          />
          <StatCard
            label={t("dashboard.statResults")}
            value={loading ? "—" : stats.results}
            sub={t("dashboard.readyToReview")}
            subVariant="up"
          />
          <StatCard
            label={t("dashboard.statSentToday")}
            value={loading ? "—" : stats.sentToday}
            sub={t("dashboard.dispatched")}
          />
        </div>

        {/* Middle row: Quick actions (2fr) + System alerts (1fr) */}
        <div className="grid grid-cols-[2fr_1fr] gap-4 mb-4">

          {/* Quick actions card */}
          <div className="bg-zt-bg-card border border-zt-border rounded-xl px-5 py-[18px]">
            <div className="text-sm font-medium text-zt-text-primary mb-3.5">
              {t("dashboard.quickActions")}
            </div>
            <div className="grid grid-cols-3 gap-2.5">

              {/* New order — primary */}
              <Link
                href="/patient"
                className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl border bg-zt-primary border-zt-primary text-center hover:bg-zt-primary-hover transition-colors"
              >
                <div className="w-9 h-9 rounded-[8px] bg-white/20 flex items-center justify-center">
                  <svg viewBox="0 0 18 18" fill="white" className="w-[18px] h-[18px]" aria-hidden="true">
                    <path d="M9 2v14M2 9h14"/>
                  </svg>
                </div>
                <span className="text-xs font-medium text-white">{t("dashboard.newOrder")}</span>
                <span className="text-[11px] text-white/70">{t("dashboard.newOrderDesc")}</span>
              </Link>

              {/* Patients */}
              <Link
                href="/patient"
                className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl border border-zt-border bg-zt-bg-card text-center hover:bg-zt-bg-page transition-colors"
              >
                <div className="w-9 h-9 rounded-[8px] bg-zt-primary-light flex items-center justify-center">
                  <svg viewBox="0 0 18 18" fill="#185FA5" className="w-[18px] h-[18px]" aria-hidden="true">
                    <circle cx="9" cy="6" r="4"/>
                    <path d="M2 16c0-4 3.1-7 7-7s7 3 7 7"/>
                  </svg>
                </div>
                <span className="text-xs font-medium text-zt-text-primary">{t("nav.patients")}</span>
                <span className="text-[11px] text-zt-text-tertiary">{t("dashboard.browseDesc")}</span>
              </Link>

              {/* Results */}
              <Link
                href="/results"
                className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl border border-zt-border bg-zt-bg-card text-center hover:bg-zt-bg-page transition-colors"
              >
                <div className="w-9 h-9 rounded-[8px] bg-zt-success-light flex items-center justify-center">
                  <svg viewBox="0 0 18 18" fill="#3B6D11" className="w-[18px] h-[18px]" aria-hidden="true">
                    <path d="M3 3h12v2H3zM3 7h12v2H3zM3 11h8v2H3z"/>
                  </svg>
                </div>
                <span className="text-xs font-medium text-zt-text-primary">{t("nav.results")}</span>
                <span className="text-[11px] text-zt-text-tertiary">{t("dashboard.resultsDesc")}</span>
              </Link>
            </div>
          </div>

          {/* System alerts card */}
          <div className="bg-zt-bg-card border border-zt-border rounded-xl px-5 py-[18px]">
            <div className="text-sm font-medium text-zt-text-primary mb-3.5">
              {t("dashboard.systemAlerts")}
            </div>
            <div className="flex flex-col gap-2">
              {stats.drafts > 0 && (
                <AlertItem
                  variant="warn"
                  text={`${stats.drafts} ${t("dashboard.alertDrafts")}`}
                  time={t("dashboard.sinceToday")}
                />
              )}
              <AlertItem
                variant="info"
                text={t("dashboard.fhirConnected")}
                time={t("dashboard.lastSyncNow")}
              />
              {stats.results > 0 && (
                <AlertItem
                  variant="success"
                  text={`${stats.results} ${t("dashboard.resultsReady")}`}
                  time={t("dashboard.updatedNow")}
                />
              )}
              {stats.drafts === 0 && stats.results === 0 && (
                <div className="text-xs text-zt-text-tertiary py-2">{t("common.noData")}</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom row: Recent orders (1fr) + Recent patients (1fr) */}
        <div className="grid grid-cols-2 gap-4">

          {/* Recent orders */}
          <div className="bg-zt-bg-card border border-zt-border rounded-xl px-5 py-[18px]">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-sm font-medium text-zt-text-primary">{t("dashboard.recentOrders")}</span>
              <Link href="/orders" className="text-xs text-zt-primary hover:underline">
                {t("dashboard.viewAll")}
              </Link>
            </div>
            <div className="flex flex-col">
              {loading && (
                <div className="py-4 text-xs text-zt-text-tertiary">{t("common.loading")}</div>
              )}
              {!loading && recentOrders.length === 0 && (
                <div className="py-4 text-xs text-zt-text-tertiary">{t("orders.noResults")}</div>
              )}
              {recentOrders.map((order, i) => (
                <Link
                  key={order.id}
                  href={`/order/${order.id}`}
                  className={`flex items-center gap-3 py-2.5 hover:bg-zt-bg-page rounded-lg px-1 -mx-1 transition-colors ${
                    i < recentOrders.length - 1 ? "border-b border-zt-border" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-zt-primary-light flex items-center justify-center text-[11px] font-medium text-zt-primary shrink-0">
                    {nameInitials(order.patientId.slice(-4))}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-zt-text-primary truncate">
                      {order.orderNumber || order.id}
                    </div>
                    <div className="text-[11px] text-zt-text-secondary truncate">{order.codeText}</div>
                  </div>
                  {/* Status pill */}
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${orderStatusPill(order.status)}`}>
                    {orderStatusLabel(order.status, t)}
                  </span>
                  {/* Date */}
                  <span className="text-[11px] text-zt-text-tertiary shrink-0 ml-2">
                    {formatOrderDate(order.authoredOn)}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent patients */}
          <div className="bg-zt-bg-card border border-zt-border rounded-xl px-5 py-[18px]">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-sm font-medium text-zt-text-primary">{t("dashboard.recentPatients")}</span>
              <Link href="/patient" className="text-xs text-zt-primary hover:underline">
                {t("dashboard.viewAll")}
              </Link>
            </div>
            <div className="flex flex-col">
              {loading && (
                <div className="py-4 text-xs text-zt-text-tertiary">{t("common.loading")}</div>
              )}
              {!loading && recentPatients.length === 0 && (
                <div className="py-4 text-xs text-zt-text-tertiary">{t("patient.noResults")}</div>
              )}
              {recentPatients.map((patient, i) => (
                <Link
                  key={patient.id}
                  href={`/patient/${patient.id}`}
                  className={`flex items-center gap-3 py-2.5 hover:bg-zt-bg-page rounded-lg px-1 -mx-1 transition-colors ${
                    i < recentPatients.length - 1 ? "border-b border-zt-border" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-zt-primary-light flex items-center justify-center text-[11px] font-medium text-zt-primary shrink-0">
                    {nameInitials(patient.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-zt-text-primary truncate">{patient.name}</div>
                    <div className="text-[11px] text-zt-text-secondary truncate">{patient.address}</div>
                  </div>
                  <span className="text-[11px] text-zt-text-tertiary shrink-0">
                    {formatDate(patient.createdAt)}
                  </span>
                </Link>
              ))}
            </div>

            {/* Quick patient search */}
            <div className="mt-3.5 pt-3 border-t border-zt-border flex gap-2">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => handlePatientSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitPatientSearch(); }}
                placeholder={t("dashboard.searchPlaceholder")}
                className="flex-1 text-xs px-2.5 py-[6px] border border-zt-border rounded-[7px] bg-zt-bg-page text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary"
              />
              <button
                type="button"
                onClick={submitPatientSearch}
                className="text-xs px-3 py-[6px] bg-zt-primary text-zt-text-on-primary rounded-[7px] hover:bg-zt-primary-hover transition-colors"
              >
                {t("common.search")}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
