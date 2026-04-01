"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
import { useTranslation } from "@/lib/i18n";
import { useRefresh } from "@/lib/refresh";

type OrderRow = {
  id: string;
  status: string;
  intent: string;
  codeText: string;
  authoredOn: string;
  orderNumber: string;
  specimenCount: number;
  patientId: string;
};

function formatDate(date?: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

type StatusMeta = {
  icon: string;
  badge: string;
  tooltipKey: string;
  editable: boolean;
};

function getStatusMeta(status: string): StatusMeta {
  switch (status) {
    case "draft":
      return {
        icon: "✏️",
        badge: "bg-gray-100 text-gray-700 border-gray-300",
        tooltipKey: "orders.tooltipDraft",
        editable: true,
      };
    case "active":
      return {
        icon: "📤",
        badge: "bg-blue-100 text-blue-700 border-blue-300",
        tooltipKey: "orders.tooltipActive",
        editable: true,
      };
    case "on-hold":
      return {
        icon: "⏸️",
        badge: "bg-yellow-100 text-yellow-700 border-yellow-300",
        tooltipKey: "orders.tooltipOnHold",
        editable: true,
      };
    case "completed":
      return {
        icon: "✅",
        badge: "bg-green-100 text-green-700 border-green-300",
        tooltipKey: "orders.tooltipCompleted",
        editable: false,
      };
    case "revoked":
      return {
        icon: "🚫",
        badge: "bg-red-100 text-red-700 border-red-300",
        tooltipKey: "orders.tooltipRevoked",
        editable: false,
      };
    case "entered-in-error":
      return {
        icon: "⚠️",
        badge: "bg-red-100 text-red-700 border-red-300",
        tooltipKey: "orders.tooltipError",
        editable: false,
      };
    default:
      return {
        icon: "❓",
        badge: "bg-gray-100 text-gray-500 border-gray-200",
        tooltipKey: "orders.statusUnknown",
        editable: false,
      };
  }
}

function statusLabel(status: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    draft: t("orders.statusDraft"),
    active: t("orders.statusActive"),
    "on-hold": t("orders.statusOnHold"),
    completed: t("orders.statusCompleted"),
    revoked: t("orders.statusRevoked"),
    "entered-in-error": t("orders.statusError"),
  };
  return map[status] || t("orders.statusUnknown");
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (k: string) => string;
}) {
  const meta = getStatusMeta(status);
  const tooltip = t(meta.tooltipKey);
  const label = statusLabel(status, t);

  return (
    <div className="relative group inline-block">
      <span
        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium cursor-default select-none ${meta.badge}`}
      >
        <span>{meta.icon}</span>
        <span>{label}</span>
      </span>
      {/* Tooltip */}
      <div className="pointer-events-none absolute left-0 top-full mt-1 z-50 w-72 rounded border border-gray-200 bg-white shadow-lg px-3 py-2 text-xs text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="font-semibold mb-1 flex items-center gap-1">
          <span>{meta.icon}</span>
          <span>{label}</span>
        </div>
        <p className="leading-relaxed text-gray-600">{tooltip}</p>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flashMsg, setFlashMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const { t } = useTranslation();
  const { refreshCount, refresh } = useRefresh();

  const loadOrders = useCallback(() => {
    setLoading(true);
    setError(null);
    let active = true;
    fetch("/api/service-requests")
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const json = (await res.json()) as { data: OrderRow[] };
        setOrders(Array.isArray(json.data) ? json.data : []);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setOrders([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    return loadOrders();
  }, [loadOrders, refreshCount]);

  const handleDelete = useCallback(
    async (o: OrderRow) => {
      if (!window.confirm(t("orders.deleteConfirm"))) return;
      setDeletingId(o.id);
      try {
        const res = await fetch(`/api/service-requests/${o.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setFlashMsg({ text: t("orders.deleteOk"), ok: true });
        refresh();
      } catch (e: unknown) {
        setFlashMsg({
          text: `${t("orders.deleteError")}: ${e instanceof Error ? e.message : String(e)}`,
          ok: false,
        });
      } finally {
        setDeletingId(null);
        window.setTimeout(() => setFlashMsg(null), 3000);
      }
    },
    [t, refresh]
  );

  const content = useMemo(() => {
    if (loading) {
      return Array.from({ length: 8 }, (_, i) => (
        <DataTableRow key={`skel-${i}`}>
          {Array.from({ length: 6 }, (__, j) => (
            <DataTableCell key={j}>
              <div className="h-4 rounded bg-gray-100 animate-pulse" />
            </DataTableCell>
          ))}
        </DataTableRow>
      ));
    }
    if (error) {
      return (
        <DataTableRow>
          <DataTableCell className="text-red-600" colSpan={6}>
            {t("orders.loadError")}: {error}
          </DataTableCell>
        </DataTableRow>
      );
    }
    if (orders.length === 0) {
      return (
        <DataTableRow>
          <DataTableCell className="text-gray-500" colSpan={6}>
            {t("orders.noResults")}
          </DataTableCell>
        </DataTableRow>
      );
    }
    return orders.map((o) => {
      const meta = getStatusMeta(o.status);
      const canEdit = meta.editable && !!o.patientId;
      const isDeleting = deletingId === o.id;

      return (
        <DataTableRow key={o.id} className={isDeleting ? "opacity-40" : ""}>
          <DataTableCell title={o.orderNumber || o.id} className="font-mono text-xs">
            {o.orderNumber || o.id}
          </DataTableCell>
          <DataTableCell title={o.codeText}>{o.codeText || "-"}</DataTableCell>
          <DataTableCell>
            <StatusBadge status={o.status} t={t} />
          </DataTableCell>
          <DataTableCell>{formatDate(o.authoredOn)}</DataTableCell>
          <DataTableCell className="text-center">{o.specimenCount || 0}</DataTableCell>
          <DataTableCell>
            <div className="flex items-center gap-1.5">
              {canEdit ? (
                <Link
                  href={`/order/${o.patientId}?sr=${o.id}`}
                  className="inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100"
                  title={t("orders.edit")}
                >
                  ✏️ {t("orders.edit")}
                </Link>
              ) : (
                <div className="relative group inline-flex items-center gap-1">
                  <span
                    className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-400 cursor-default select-none"
                  >
                    🔒 {t("orders.locked")}
                  </span>
                  {/* Tooltip explaining why locked and what to do */}
                  <div className="pointer-events-none absolute left-0 top-full mt-1 z-50 w-72 rounded border border-gray-200 bg-white shadow-lg px-3 py-2 text-xs text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <p className="font-semibold mb-1">{t("orders.lockedHint")}</p>
                    <p className="text-gray-500 leading-relaxed">{t(meta.tooltipKey)}</p>
                    {o.patientId && (
                      <p className="mt-2 text-blue-600">
                        → <a href={`/patient/${o.patientId}`} className="underline hover:text-blue-800 pointer-events-auto">{t("orders.openPatient")}</a>
                      </p>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={() => handleDelete(o)}
                disabled={isDeleting}
                title={t("orders.delete")}
                className="inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600 hover:bg-red-100 disabled:opacity-40"
              >
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
      <nav className="mb-2 text-sm text-gray-600" aria-label="Brotkrumen">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="inline-flex items-center gap-1 text-blue-600 hover:underline" title={t("nav.home")}>
              🏠 {t("nav.home")}
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-700">{t("orders.title")}</li>
        </ol>
      </nav>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t("orders.title")}</h1>
        {flashMsg && (
          <div
            className={`rounded border px-3 py-1.5 text-sm ${
              flashMsg.ok
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-red-300 bg-red-50 text-red-700"
            }`}
          >
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
