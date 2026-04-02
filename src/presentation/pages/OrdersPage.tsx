"use client";

/**
 * Clean-Architecture version of the Orders page.
 *
 * This file lives in the presentation layer and uses the CA stack:
 *   useOrders → OrderService → FhirOrderRepository → /api/service-requests
 *
 * The existing app/orders/page.tsx continues to work unchanged.
 * This page can be adopted gradually by updating app/orders/page.tsx
 * to import from here instead of containing the logic inline.
 */

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  DataTable,
  DataTableHead,
  DataTableHeadRow,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from "@/components/Table";
import { useOrders } from "@/presentation/hooks/useOrders";
import { formatDate } from "@/shared/utils/formatDate";
import { useTranslation } from "@/lib/i18n";
import { useRefresh } from "@/lib/refresh";
import type { Order, OrderStatus } from "@/domain/entities/Order";

// ── Status helpers ────────────────────────────────────────────────────────────

type StatusMeta = { icon: string; badge: string; tooltipKey: string; editable: boolean };

function getStatusMeta(status: OrderStatus | string): StatusMeta {
  switch (status) {
    case "draft":            return { icon: "✏️",  badge: "bg-gray-100 text-gray-700 border-gray-300",      tooltipKey: "orders.tooltipDraft",     editable: true  };
    case "active":           return { icon: "📤",  badge: "bg-blue-100 text-blue-700 border-blue-300",      tooltipKey: "orders.tooltipActive",    editable: true  };
    case "on-hold":          return { icon: "⏸️",  badge: "bg-yellow-100 text-yellow-700 border-yellow-300", tooltipKey: "orders.tooltipOnHold",   editable: true  };
    case "completed":        return { icon: "✅",  badge: "bg-green-100 text-green-700 border-green-300",   tooltipKey: "orders.tooltipCompleted", editable: false };
    case "revoked":          return { icon: "🚫",  badge: "bg-red-100 text-red-700 border-red-300",         tooltipKey: "orders.tooltipRevoked",   editable: false };
    case "entered-in-error": return { icon: "⚠️",  badge: "bg-red-100 text-red-700 border-red-300",         tooltipKey: "orders.tooltipError",     editable: false };
    default:                 return { icon: "❓",  badge: "bg-gray-100 text-gray-500 border-gray-200",      tooltipKey: "orders.statusUnknown",    editable: false };
  }
}

const STATUS_LABELS: Record<string, string> = {
  draft: "orders.statusDraft", active: "orders.statusActive",
  "on-hold": "orders.statusOnHold", completed: "orders.statusCompleted",
  revoked: "orders.statusRevoked", "entered-in-error": "orders.statusError",
};

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const meta = getStatusMeta(status);
  const labelKey = STATUS_LABELS[status] ?? "orders.statusUnknown";
  const label = t(labelKey);
  return (
    <div className="relative group inline-block">
      <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium cursor-default select-none ${meta.badge}`}>
        <span>{meta.icon}</span><span>{label}</span>
      </span>
      <div className="pointer-events-none absolute left-0 top-full mt-1 z-50 w-72 rounded border border-gray-200 bg-white shadow-lg px-3 py-2 text-xs text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="font-semibold mb-1 flex items-center gap-1"><span>{meta.icon}</span><span>{label}</span></div>
        <p className="leading-relaxed text-gray-600">{t(meta.tooltipKey)}</p>
      </div>
    </div>
  );
}

// ── OrdersPage ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { t } = useTranslation();
  const { refresh } = useRefresh();
  const { orders, loading, error, reload, deleteOrder } = useOrders();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flashMsg, setFlashMsg] = useState<{ text: string; ok: boolean } | null>(null);

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

  const content = useMemo(() => {
    if (loading) {
      return Array.from({ length: 8 }, (_, i) => (
        <DataTableRow key={`skel-${i}`}>
          {Array.from({ length: 6 }, (__, j) => (
            <DataTableCell key={j}><div className="h-4 rounded bg-gray-100 animate-pulse" /></DataTableCell>
          ))}
        </DataTableRow>
      ));
    }
    if (error) {
      return <DataTableRow><DataTableCell colSpan={6} className="text-red-600">{t("orders.loadError")}: {error}</DataTableCell></DataTableRow>;
    }
    if (orders.length === 0) {
      return <DataTableRow><DataTableCell colSpan={6} className="text-gray-500">{t("orders.noResults")}</DataTableCell></DataTableRow>;
    }
    return orders.map((o) => {
      const meta = getStatusMeta(o.status);
      const canEdit = meta.editable && !!o.patientId;
      const isDeleting = deletingId === o.id;
      return (
        <DataTableRow key={o.id} className={isDeleting ? "opacity-40" : ""}>
          <DataTableCell title={o.orderNumber || o.id} className="font-mono text-xs">{o.orderNumber || o.id}</DataTableCell>
          <DataTableCell title={o.codeText}>{o.codeText || "—"}</DataTableCell>
          <DataTableCell><StatusBadge status={o.status} t={t} /></DataTableCell>
          <DataTableCell>{formatDate(o.authoredOn)}</DataTableCell>
          <DataTableCell className="text-center">{o.specimenCount || 0}</DataTableCell>
          <DataTableCell>
            <div className="flex items-center gap-1.5">
              {canEdit ? (
                <Link href={`/order/${o.patientId}?sr=${o.id}`} className="inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100">
                  ✏️ {t("orders.edit")}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-400">🔒 {t("orders.locked")}</span>
              )}
              <button onClick={() => handleDelete(o)} disabled={isDeleting} title={t("orders.delete")} className="inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600 hover:bg-red-100 disabled:opacity-40">
                🗑️
              </button>
            </div>
          </DataTableCell>
        </DataTableRow>
      );
    });
  }, [loading, error, orders, deletingId, t, handleDelete]);

  return (
    <div className="p-4">
      <nav className="mb-2 text-sm text-gray-600">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="text-blue-600 hover:underline">🏠 {t("nav.home")}</Link></li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-700">{t("orders.title")}</li>
        </ol>
      </nav>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t("orders.title")}</h1>
        {flashMsg && (
          <div className={`rounded border px-3 py-1.5 text-sm ${flashMsg.ok ? "border-green-300 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"}`}>
            {flashMsg.text}
          </div>
        )}
      </div>
      <DataTable>
        <DataTableHead>
          <DataTableHeadRow>
            <DataTableHeaderCell className="w-56">{t("orders.id")}</DataTableHeaderCell>
            <DataTableHeaderCell>{t("orders.description")}</DataTableHeaderCell>
            <DataTableHeaderCell className="w-44">{t("orders.status")}</DataTableHeaderCell>
            <DataTableHeaderCell className="w-36">{t("orders.date")}</DataTableHeaderCell>
            <DataTableHeaderCell className="w-20 text-center">{t("orders.specimens")}</DataTableHeaderCell>
            <DataTableHeaderCell className="w-40">{t("orders.actions")}</DataTableHeaderCell>
          </DataTableHeadRow>
        </DataTableHead>
        <DataTableBody>{content}</DataTableBody>
      </DataTable>
    </div>
  );
}
