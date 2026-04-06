"use client";

/**
 * Clean-Architecture version of the Orders page.
 *
 * Layout matches design/orders.html:
 *   AppSidebar + content area with stats row, toolbar, table, footer.
 *
 * Data flow:
 *   useOrders → OrderService → FhirOrderRepository → /api/service-requests
 */

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/presentation/ui/Badge";
import type { BadgeVariant } from "@/presentation/ui/Badge";
import { OrgBadgeOrDash } from "@/presentation/ui/OrgBadge";
import { useOrders } from "@/presentation/hooks/useOrders";
import { formatDate } from "@/shared/utils/formatDate";
import { useTranslation } from "@/lib/i18n";
import { useRefresh } from "@/lib/refresh";
import type { Order, OrderStatus } from "@/domain/entities/Order";

// ── Status helpers ────────────────────────────────────────────────────────────

type StatusMeta = { icon: string; variant: BadgeVariant; tooltipKey: string; editable: boolean };

function getStatusMeta(status: OrderStatus | string): StatusMeta {
  switch (status) {
    case "draft":            return { icon: "✏️",  variant: "neutral",  tooltipKey: "orders.tooltipDraft",     editable: true  };
    case "active":           return { icon: "📤",  variant: "info",     tooltipKey: "orders.tooltipActive",    editable: true  };
    case "on-hold":          return { icon: "⏸️",  variant: "warning",  tooltipKey: "orders.tooltipOnHold",    editable: true  };
    case "completed":        return { icon: "✅",  variant: "success",  tooltipKey: "orders.tooltipCompleted", editable: false };
    case "revoked":          return { icon: "🚫",  variant: "danger",   tooltipKey: "orders.tooltipRevoked",   editable: false };
    case "entered-in-error": return { icon: "⚠️",  variant: "danger",   tooltipKey: "orders.tooltipError",     editable: false };
    default:                 return { icon: "❓",  variant: "neutral",  tooltipKey: "orders.statusUnknown",    editable: false };
  }
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: "orders.statusDraft",
  active: "orders.statusActive",
  "on-hold": "orders.statusOnHold",
  completed: "orders.statusCompleted",
  revoked: "orders.statusRevoked",
  "entered-in-error": "orders.statusError",
};

function StatusPill({ status, t }: { status: string; t: (k: string) => string }) {
  const meta = getStatusMeta(status);
  const label = t(STATUS_LABEL_KEYS[status] ?? "orders.statusUnknown");
  return (
    <Badge
      label={label}
      variant={meta.variant}
      icon={meta.icon}
      tooltip={t(meta.tooltipKey)}
    />
  );
}

// ── PatientAvatar ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-zt-primary-light text-zt-primary",
  "bg-zt-success-light text-zt-success",
  "bg-zt-warning-bg text-zt-warning-text",
  "bg-zt-danger-light text-zt-danger",
  "bg-zt-amended-light text-zt-amended",
];

function patientInitials(patientId: string | undefined): string {
  if (!patientId) return "?";
  return patientId.slice(0, 2).toUpperCase();
}

function avatarColor(patientId: string | undefined): string {
  if (!patientId) return AVATAR_COLORS[0]!;
  let hash = 0;
  for (let i = 0; i < patientId.length; i++) hash = (hash * 31 + patientId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

function PatientAvatar({ patientId }: { patientId: string | undefined }) {
  const initials = patientInitials(patientId);
  const color = avatarColor(patientId);
  return (
    <div
      className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 select-none ${color}`}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  iconBg,
  icon,
}: {
  label: string;
  value: number;
  iconBg: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-zt-bg-card border border-zt-border rounded-[10px] px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-zt-text-tertiary">{label}</div>
        <div className="text-[20px] font-medium text-zt-text-primary leading-tight">{value}</div>
      </div>
    </div>
  );
}

// ── Filter type ───────────────────────────────────────────────────────────────

type FilterKey = "all" | "draft" | "active" | "completed";

// ── OrdersPage ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { t } = useTranslation();
  const { refresh } = useRefresh();
  const { orders, loading, error, reload, deleteOrder } = useOrders();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flashMsg, setFlashMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Stats (computed from full list) ───────────────────────────────────────
  const stats = useMemo(() => {
    const total = orders.length;
    const drafts = orders.filter((o) => o.status === "draft").length;
    const sent = orders.filter((o) => o.status === "active").length;
    const done = orders.filter((o) => o.status === "completed").length;
    return { total, drafts, sent, done };
  }, [orders]);

  // ── Filter chips ──────────────────────────────────────────────────────────
  const filterChips: { key: FilterKey; labelKey: string; count: number | null; style: string }[] = [
    { key: "all",       labelKey: "orders.filterAll",   count: null,         style: "on" },
    { key: "draft",     labelKey: "orders.filterDraft", count: stats.drafts, style: "amber" },
    { key: "active",    labelKey: "orders.filterSent",  count: stats.sent,   style: "default" },
    { key: "completed", labelKey: "orders.filterDone",  count: stats.done,   style: "green" },
  ];

  // ── Filtered & searched rows ──────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      const q = search.toLowerCase();
      if (q && !o.orderNumber?.toLowerCase().includes(q) && !o.codeText?.toLowerCase().includes(q) && !o.patientId?.toLowerCase().includes(q)) return false;
      if (dateFrom) {
        const from = dateFrom.split(".").reverse().join("-");
        if (o.authoredOn && o.authoredOn < from) return false;
      }
      if (dateTo) {
        const to = dateTo.split(".").reverse().join("-");
        if (o.authoredOn && o.authoredOn > to) return false;
      }
      return true;
    });
  }, [orders, filter, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageFrom = (currentPage - 1) * pageSize + 1;
  const pageTo = Math.min(currentPage * pageSize, filteredOrders.length);
  const pageRows = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (o: Order) => {
    if (!window.confirm(t("orders.deleteConfirm"))) return;
    setDeletingId(o.id);
    try {
      await deleteOrder(o.id);
      setFlashMsg({ text: t("orders.deleteOk"), ok: true });
      reload();
      refresh();
    } catch (e: unknown) {
      setFlashMsg({
        text: `${t("orders.deleteError")}: ${e instanceof Error ? e.message : String(e)}`,
        ok: false,
      });
    } finally {
      setDeletingId(null);
      setTimeout(() => setFlashMsg(null), 3000);
    }
  }, [t, deleteOrder, reload, refresh]);

  // ── Chip style helper ─────────────────────────────────────────────────────
  function chipClass(chip: typeof filterChips[0]) {
    const active = filter === chip.key;
    if (active) {
      if (chip.style === "amber")   return "bg-zt-warning-bg text-zt-warning-text border-zt-warning-border";
      if (chip.style === "green")   return "bg-zt-success-light text-zt-success border-zt-success-border";
      return "bg-zt-primary-light text-zt-primary border-zt-primary-border";
    }
    return "bg-zt-bg-card text-zt-text-secondary border-zt-border hover:bg-zt-bg-page hover:text-zt-text-primary";
  }

  // ── Pagination pages ──────────────────────────────────────────────────────
  const pageNums: number[] = [];
  for (let i = 1; i <= totalPages; i++) pageNums.push(i);
  const visiblePages = pageNums.length <= 7
    ? pageNums
    : [
        ...pageNums.slice(0, Math.min(currentPage, 3)),
        ...(currentPage > 3 && currentPage < totalPages - 2 ? [currentPage] : []),
        ...pageNums.slice(Math.max(totalPages - 2, currentPage)),
      ].filter((v, i, a) => a.indexOf(v) === i);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />

      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[1200px] mx-auto">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary mb-4" aria-label="Brotkrumen">
            <BackButton />
            <span className="text-zt-text-tertiary">|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("orders.title")}</span>
          </nav>

          {/* Page header */}
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-[20px] font-medium text-zt-text-primary">{t("orders.title")}</h1>
            <div className="flex items-center gap-2">
              {flashMsg && (
                <div className={`rounded border px-3 py-1.5 text-[12px] ${
                  flashMsg.ok
                    ? "border-zt-success-border bg-zt-success-light text-zt-success"
                    : "border-zt-danger-border bg-zt-danger-light text-zt-danger"
                }`}>
                  {flashMsg.text}
                </div>
              )}
              <Link
                href="/patient"
                className="flex items-center gap-1.5 text-[13px] px-3.5 py-[7px] rounded-lg bg-zt-primary text-zt-text-on-primary border border-zt-primary hover:bg-zt-primary/90 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {t("order.newOrder")}
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <StatCard
              label={t("orders.total")}
              value={stats.total}
              iconBg="bg-zt-primary-light"
              icon={
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" className="text-zt-primary">
                  <rect x="2" y="2" width="14" height="14" rx="2"/>
                </svg>
              }
            />
            <StatCard
              label={t("orders.drafts")}
              value={stats.drafts}
              iconBg="bg-zt-warning-bg"
              icon={
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-zt-warning-text">
                  <path d="M9 3v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              }
            />
            <StatCard
              label={t("orders.sent")}
              value={stats.sent}
              iconBg="bg-zt-primary-light"
              icon={
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-zt-primary">
                  <path d="M3 9l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            />
            <StatCard
              label={t("orders.resultsReady")}
              value={stats.done}
              iconBg="bg-zt-success-light"
              icon={
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-zt-success">
                  <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[320px]">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zt-text-tertiary pointer-events-none"
                width="13" height="13" viewBox="0 0 13 13" fill="none"
                aria-hidden="true"
              >
                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("orders.searchPlaceholder")}
                className="w-full pl-8 pr-3 py-2 text-[13px] border border-zt-border rounded-lg bg-zt-bg-card text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary focus:ring-1 focus:ring-zt-primary/20"
              />
            </div>

            {/* Filter chips */}
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => { setFilter(chip.key); setPage(1); }}
                className={`text-[12px] px-[11px] py-[5px] rounded-full border whitespace-nowrap flex items-center gap-1 transition-colors ${chipClass(chip)}`}
              >
                {t(chip.labelKey)}
                {chip.count !== null && ` (${chip.count})`}
              </button>
            ))}

            {/* Date range */}
            <div className="flex items-center gap-1.5 ml-auto">
              <input
                type="text"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                placeholder="Von"
                className="w-[110px] px-2.5 py-1.5 text-[12px] border border-zt-border rounded-lg bg-zt-bg-card text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary"
              />
              <span className="text-[12px] text-zt-text-tertiary">–</span>
              <input
                type="text"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                placeholder="Bis"
                className="w-[110px] px-2.5 py-1.5 text-[12px] border border-zt-border rounded-lg bg-zt-bg-card text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-zt-bg-card border border-zt-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-zt-bg-page">
                  {[
                    { key: "id",             label: t("orders.id"),              cls: "w-40" },
                    { key: "patient",        label: t("orders.patient"),          cls: "" },
                    { key: "description",    label: t("orders.description"),      cls: "" },
                    { key: "auftraggeber",   label: t("org.auftraggeber"),         cls: "w-36" },
                    { key: "auftragnehmer",  label: t("org.auftragnehmer"),        cls: "w-36" },
                    { key: "status",         label: t("orders.status"),           cls: "w-36" },
                    { key: "date",           label: t("orders.date"),             cls: "w-28" },
                    { key: "specimens",      label: t("orders.specimens"),        cls: "w-20" },
                    { key: "actions",        label: t("orders.actions"),          cls: "w-36" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className={`text-left text-[11px] font-medium text-zt-text-secondary uppercase tracking-[0.04em] px-4 py-2.5 border-b border-zt-border whitespace-nowrap ${col.cls}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }, (_, i) => (
                  <tr key={`skel-${i}`} className="border-b border-zt-border/50 last:border-0">
                    {Array.from({ length: 9 }, (__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-zt-bg-muted animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && error && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-[13px] text-zt-danger">
                      {t("orders.loadError")}: {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-[13px] text-zt-text-tertiary">
                      {t("orders.noResults")}
                    </td>
                  </tr>
                )}

                {!loading && !error && pageRows.map((o) => {
                  const meta = getStatusMeta(o.status);
                  const canEdit = meta.editable && !!o.patientId;
                  const isDeleting = deletingId === o.id;
                  return (
                    <tr
                      key={o.id}
                      className={`border-b border-zt-border/50 last:border-0 transition-colors hover:bg-zt-bg-page ${isDeleting ? "opacity-40" : ""}`}
                    >
                      {/* Order ID */}
                      <td className="px-4 py-[11px] align-middle">
                        <span className="text-[11px] text-zt-text-tertiary font-mono">
                          {o.orderNumber || o.id}
                        </span>
                      </td>

                      {/* Patient */}
                      <td className="px-4 py-[11px] align-middle">
                        {o.patientId ? (
                          <Link
                            href={`/patient/${o.patientId}`}
                            className="flex items-center gap-2 hover:underline"
                            title={o.patientId}
                          >
                            <PatientAvatar patientId={o.patientId} />
                            <span className="text-[13px] text-zt-text-primary truncate max-w-[120px]">
                              {o.patientId}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-zt-text-tertiary text-[13px]">—</span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="px-4 py-[11px] align-middle">
                        <div className="text-[13px] text-zt-text-primary">{o.codeText || "—"}</div>
                        {o.specimenCount > 0 && (
                          <div className="text-[11px] text-zt-text-tertiary mt-0.5">
                            {o.specimenCount} {o.specimenCount === 1 ? "Probe" : "Proben"}
                          </div>
                        )}
                      </td>

                      {/* Auftraggeber (sender) */}
                      <td className="px-4 py-[11px] align-middle">
                        <OrgBadgeOrDash org={o.sender} variant="sender" />
                      </td>

                      {/* Auftragnehmer (receivers) */}
                      <td className="px-4 py-[11px] align-middle">
                        {o.receivers.length > 0
                          ? o.receivers.map((r, i) => (
                              <OrgBadgeOrDash key={i} org={r} variant="receiver" />
                            ))
                          : <span className="text-zt-text-tertiary text-[12px]">—</span>
                        }
                      </td>

                      {/* Status */}
                      <td className="px-4 py-[11px] align-middle">
                        <StatusPill status={o.status} t={t} />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-[11px] align-middle text-[12px] text-zt-text-secondary whitespace-nowrap">
                        {formatDate(o.authoredOn)}
                      </td>

                      {/* Specimens */}
                      <td className="px-4 py-[11px] align-middle">
                        <span className="text-[12px] text-zt-text-secondary bg-zt-bg-page px-2 py-0.5 rounded-lg inline-block">
                          {o.specimenCount ?? 0}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-[11px] align-middle">
                        <div className="flex items-center gap-1.5">
                          {canEdit ? (
                            <Link
                              href={`/order/${o.patientId}?sr=${o.id}`}
                              className="text-[11px] px-[9px] py-[3px] rounded-[6px] border border-zt-border bg-zt-bg-card text-zt-text-primary hover:bg-zt-bg-page whitespace-nowrap transition-colors"
                            >
                              {t("orders.edit")}
                            </Link>
                          ) : (
                            <span className="text-[11px] px-[9px] py-[3px] rounded-[6px] border border-zt-border bg-zt-bg-muted text-zt-text-tertiary whitespace-nowrap cursor-default">
                              {t("orders.locked")}
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(o)}
                            disabled={isDeleting}
                            title={t("orders.delete")}
                            className="text-[11px] px-[9px] py-[3px] rounded-[6px] border border-zt-danger-border bg-zt-bg-card text-zt-danger hover:bg-zt-danger-light whitespace-nowrap transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            {t("orders.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Table footer */}
            {!loading && !error && filteredOrders.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zt-border bg-zt-bg-page">
                <div className="flex items-center gap-4">
                  {/* Showing X–Y of Z */}
                  <span className="text-[12px] text-zt-text-tertiary">
                    {t("orders.showingOf")
                      .replace("{from}", String(pageFrom))
                      .replace("{to}", String(pageTo))
                      .replace("{total}", String(filteredOrders.length))}
                  </span>
                  {/* Rows per page */}
                  <div className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary">
                    {t("orders.rowsPerPage")}:
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="text-[12px] px-1.5 py-0.5 border border-zt-border rounded-md bg-zt-bg-card text-zt-text-primary outline-none"
                    >
                      {[10, 25, 50].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={currentPage === 1}
                    className="w-7 h-7 rounded-[7px] border border-zt-border bg-zt-bg-card text-zt-text-secondary text-[12px] flex items-center justify-center hover:bg-zt-bg-page disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    aria-label="Erste Seite"
                  >«</button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-7 h-7 rounded-[7px] border border-zt-border bg-zt-bg-card text-zt-text-secondary text-[12px] flex items-center justify-center hover:bg-zt-bg-page disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    aria-label="Vorherige Seite"
                  >‹</button>
                  {visiblePages.map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`w-7 h-7 rounded-[7px] border text-[12px] flex items-center justify-center cursor-pointer transition-colors ${
                        n === currentPage
                          ? "bg-zt-primary text-zt-text-on-primary border-zt-primary"
                          : "border-zt-border bg-zt-bg-card text-zt-text-secondary hover:bg-zt-bg-page"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-7 h-7 rounded-[7px] border border-zt-border bg-zt-bg-card text-zt-text-secondary text-[12px] flex items-center justify-center hover:bg-zt-bg-page disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    aria-label="Nächste Seite"
                  >›</button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="w-7 h-7 rounded-[7px] border border-zt-border bg-zt-bg-card text-zt-text-secondary text-[12px] flex items-center justify-center hover:bg-zt-bg-page disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    aria-label="Letzte Seite"
                  >»</button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
