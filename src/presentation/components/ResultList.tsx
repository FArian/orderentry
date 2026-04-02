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
import { Badge } from "@/presentation/ui/Badge";
import type { BadgeVariant } from "@/presentation/ui/Badge";
import { formatDate } from "@/shared/utils/formatDate";
import type { Result } from "@/domain/entities/Result";
import type { ModalState } from "@/presentation/components/PreviewModal";

// ── DiagnosticReport status badge ─────────────────────────────────────────────
// Exported so befunde/page.tsx can use the same component without duplication.

type DrStatusMeta = { icon: string; variant: BadgeVariant; label: string; tooltip: string };

export function getDrStatusMeta(
  status: string,
  t: (k: string) => string,
): DrStatusMeta {
  switch (status) {
    case "registered":
      return { icon: "📝", variant: "neutral",  label: t("befunde.statusRegistered"),  tooltip: t("befunde.tooltipRegistered")  };
    case "partial":
      return { icon: "⏳", variant: "warning",  label: t("befunde.statusPartial"),     tooltip: t("befunde.tooltipPartial")     };
    case "preliminary":
      return { icon: "🔬", variant: "info",     label: t("befunde.statusPreliminary"), tooltip: t("befunde.tooltipPreliminary") };
    case "final":
      return { icon: "✅", variant: "success",  label: t("befunde.statusFinal"),       tooltip: t("befunde.tooltipFinal")       };
    case "amended":
      return { icon: "✏️", variant: "amended",  label: t("befunde.statusAmended"),     tooltip: t("befunde.tooltipAmended")     };
    case "corrected":
      return { icon: "🔄", variant: "amended",  label: t("befunde.statusCorrected"),   tooltip: t("befunde.tooltipCorrected")   };
    case "cancelled":
      return { icon: "🚫", variant: "danger",   label: t("befunde.statusCancelled"),   tooltip: t("befunde.tooltipCancelled")   };
    default:
      return { icon: "❓", variant: "neutral",  label: status || "?",                  tooltip: ""                              };
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
    <Badge
      label={meta.label}
      variant={meta.variant}
      icon={meta.icon}
      {...(meta.tooltip ? { tooltip: meta.tooltip } : {})}
    />
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
              <div className="h-4 rounded bg-zt-bg-muted animate-pulse" />
            </DataTableCell>
          ))}
        </DataTableRow>
      ));
    }

    if (error) {
      return (
        <DataTableRow>
          <DataTableCell colSpan={colCount} className="text-zt-danger">
            {t("results.loadError")}: {error}
          </DataTableCell>
        </DataTableRow>
      );
    }

    if (results.length === 0) {
      return (
        <DataTableRow>
          <DataTableCell colSpan={colCount} className="text-zt-text-tertiary">
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
        <DataTableCell className="w-36 text-xs text-zt-text-secondary">
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
    return <span className="text-zt-text-tertiary text-xs">—</span>;
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
            className="text-zt-primary hover:underline text-xs font-mono"
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
