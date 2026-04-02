"use client";

import { useMemo } from "react";
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
import { PatientCard } from "@/presentation/components/PatientCard";
import { PreviewButtons } from "@/presentation/components/PreviewModal";
import { formatDate } from "@/shared/utils/formatDate";
import type { Result } from "@/domain/entities/Result";
import type { ModalState } from "@/presentation/components/PreviewModal";

// ── DiagnosticReport status badge ─────────────────────────────────────────────
// Exported so befunde/page.tsx can use the same component without duplication.

type DrStatusMeta = { icon: string; badge: string; label: string; tooltip: string };

export function getDrStatusMeta(
  status: string,
  t: (k: string) => string,
): DrStatusMeta {
  switch (status) {
    case "registered":
      return { icon: "📝", badge: "bg-gray-100 text-gray-700 border-gray-300",       label: t("befunde.statusRegistered"),  tooltip: t("befunde.tooltipRegistered")  };
    case "partial":
      return { icon: "⏳", badge: "bg-yellow-100 text-yellow-700 border-yellow-300", label: t("befunde.statusPartial"),     tooltip: t("befunde.tooltipPartial")     };
    case "preliminary":
      return { icon: "🔬", badge: "bg-blue-100 text-blue-700 border-blue-300",       label: t("befunde.statusPreliminary"), tooltip: t("befunde.tooltipPreliminary") };
    case "final":
      return { icon: "✅", badge: "bg-green-100 text-green-700 border-green-300",    label: t("befunde.statusFinal"),       tooltip: t("befunde.tooltipFinal")       };
    case "amended":
      return { icon: "✏️", badge: "bg-purple-100 text-purple-700 border-purple-300", label: t("befunde.statusAmended"),     tooltip: t("befunde.tooltipAmended")     };
    case "corrected":
      return { icon: "🔄", badge: "bg-purple-100 text-purple-700 border-purple-300", label: t("befunde.statusCorrected"),   tooltip: t("befunde.tooltipCorrected")   };
    case "cancelled":
      return { icon: "🚫", badge: "bg-red-100 text-red-700 border-red-300",          label: t("befunde.statusCancelled"),   tooltip: t("befunde.tooltipCancelled")   };
    default:
      return { icon: "❓", badge: "bg-gray-100 text-gray-500 border-gray-200",       label: status || "?",                  tooltip: ""                              };
  }
}

export function DiagnosticReportStatusBadge({
  status,
  t,
}: {
  status: string;
  t: (k: string) => string;
}) {
  const meta = getDrStatusMeta(status, t);
  return (
    <div className="relative group inline-block">
      <span
        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium cursor-default select-none ${meta.badge}`}
      >
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
      </span>
      {meta.tooltip && (
        <div className="pointer-events-none absolute left-0 top-full mt-1 z-50 w-64 rounded border border-gray-200 bg-white shadow-lg px-3 py-2 text-xs text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div className="font-semibold mb-1">
            {meta.icon} {meta.label}
          </div>
          <p className="leading-relaxed text-gray-600">{meta.tooltip}</p>
        </div>
      )}
    </div>
  );
}

// ── ResultList ────────────────────────────────────────────────────────────────

interface ResultListProps {
  results: Result[];
  loading: boolean;
  error: string | null;
  t: (key: string) => string;
  onOpenModal: (modal: ModalState) => void;
  /** Column count used for colSpan on empty / error rows (default: 7). */
  colCount?: number;
}

export function ResultList({
  results,
  loading,
  error,
  t,
  onOpenModal,
  colCount = 7,
}: ResultListProps) {
  const rows = useMemo(() => {
    if (loading) {
      return Array.from({ length: 6 }, (_, i) => (
        <DataTableRow key={`skel-${i}`}>
          {Array.from({ length: colCount }, (__, j) => (
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
          <DataTableCell colSpan={colCount} className="text-red-600">
            {t("results.loadError")}: {error}
          </DataTableCell>
        </DataTableRow>
      );
    }

    if (results.length === 0) {
      return (
        <DataTableRow>
          <DataTableCell colSpan={colCount} className="text-gray-500">
            {t("results.noResults")}
          </DataTableCell>
        </DataTableRow>
      );
    }

    return results.map((r) => (
      <DataTableRow key={r.id}>
        {/* Patient */}
        <DataTableCell>
          <PatientCard id={r.patientId} display={r.patientDisplay} />
        </DataTableCell>

        {/* Test / code */}
        <DataTableCell title={r.codeText}>
          <span className="text-sm">{r.codeText || "—"}</span>
        </DataTableCell>

        {/* Category */}
        <DataTableCell className="w-36 text-xs text-gray-600">
          {r.category || "—"}
        </DataTableCell>

        {/* Status */}
        <DataTableCell className="w-40">
          <DiagnosticReportStatusBadge status={r.status} t={t} />
        </DataTableCell>

        {/* Date */}
        <DataTableCell className="w-32 text-sm">
          {formatDate(r.effectiveDate)}
        </DataTableCell>

        {/* Order reference */}
        <DataTableCell className="w-40">
          <OrderReferences basedOn={r.basedOn} patientId={r.patientId} />
        </DataTableCell>

        {/* Documents */}
        <DataTableCell className="w-32">
          <PreviewButtons
            pdfData={r.pdfData}
            pdfTitle={r.pdfTitle ?? r.codeText}
            hl7Data={r.hl7Data}
            hl7Title={r.hl7Title ?? "HL7 ORU^R01"}
            onOpen={onOpenModal}
          />
        </DataTableCell>
      </DataTableRow>
    ));
  }, [results, loading, error, t, onOpenModal, colCount]);

  return (
    <DataTable>
      <DataTableHead>
        <DataTableHeadRow>
          <DataTableHeaderCell className="w-48">{t("results.patient")}</DataTableHeaderCell>
          <DataTableHeaderCell>{t("results.code")}</DataTableHeaderCell>
          <DataTableHeaderCell className="w-36">{t("results.category")}</DataTableHeaderCell>
          <DataTableHeaderCell className="w-40">{t("results.status")}</DataTableHeaderCell>
          <DataTableHeaderCell className="w-32">{t("results.date")}</DataTableHeaderCell>
          <DataTableHeaderCell className="w-40">{t("results.order")}</DataTableHeaderCell>
          <DataTableHeaderCell className="w-32">{t("results.documents")}</DataTableHeaderCell>
        </DataTableHeadRow>
      </DataTableHead>
      <DataTableBody>{rows}</DataTableBody>
    </DataTable>
  );
}

// ── Small sub-components (extracted to keep rows readable) ────────────────────

function OrderReferences({
  basedOn,
  patientId,
}: {
  basedOn: string[];
  patientId: string;
}) {
  if (basedOn.length === 0) {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {basedOn.map((ref) => {
        const srId = ref.startsWith("ServiceRequest/")
          ? ref.slice("ServiceRequest/".length)
          : ref;
        return (
          <Link
            key={ref}
            href={`/order/${patientId}?sr=${srId}`}
            className="text-blue-600 hover:underline text-xs font-mono"
            title={`ServiceRequest/${srId}`}
          >
            📋 {srId}
          </Link>
        );
      })}
    </div>
  );
}

// Re-export for convenience — callers can import from a single location.
export type { ModalState };
