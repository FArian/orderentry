"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { useResults } from "@/presentation/hooks/useResults";
import { ResultList } from "@/presentation/components/ResultList";
import { SearchBar } from "@/presentation/components/SearchBar";
import { PreviewModal } from "@/presentation/components/PreviewModal";
import { patientSearchSelector } from "@/application/strategies/PatientSearchStrategy";
import { useTranslation } from "@/lib/i18n";
import { useRefresh } from "@/lib/refresh";
import type { ModalState } from "@/presentation/components/PreviewModal";
import { AppSidebar } from "@/components/AppSidebar";

// ── Status filter options (all FHIR DiagnosticReport statuses) ────────────────

function statusChipActiveClass(status: string): string {
  switch (status) {
    case "final":
    case "corrected":  return "bg-zt-success-light text-zt-success border-zt-success-border font-medium";
    case "amended":    return "bg-zt-amended-light text-zt-amended border-zt-amended-border font-medium";
    case "cancelled":  return "bg-zt-danger-light text-zt-danger border-zt-danger-border font-medium";
    case "partial":
    case "preliminary":
    case "registered": return "bg-zt-info-light text-zt-info border-zt-info-border font-medium";
    default:           return "bg-zt-primary-light text-zt-primary border-zt-primary-border font-medium";
  }
}

const STATUS_OPTIONS = [
  "registered",
  "partial",
  "preliminary",
  "final",
  "amended",
  "corrected",
  "cancelled",
] as const;

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page,
  pageSize,
  total,
  onPage,
  t,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  t: (k: string) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-zt-border bg-zt-bg-page">
      <span className="text-xs text-zt-text-tertiary">
        {t("patient.showing")} {from}–{to} {t("patient.of")} {total}
      </span>
      <div className="flex items-center gap-1">
        <PaginationButton label="«" disabled={page <= 1}          onClick={() => onPage(1)} />
        <PaginationButton label="‹" disabled={page <= 1}          onClick={() => onPage(page - 1)} />
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`w-7 h-7 rounded-[7px] border text-xs flex items-center justify-center transition-colors ${
                p === page
                  ? "bg-zt-primary text-zt-text-on-primary border-zt-primary"
                  : "bg-zt-bg-card border-zt-border text-zt-text-secondary hover:bg-zt-bg-page"
              }`}
            >
              {p}
            </button>
          );
        })}
        <PaginationButton label="›" disabled={page >= totalPages} onClick={() => onPage(page + 1)} />
        <PaginationButton label="»" disabled={page >= totalPages} onClick={() => onPage(totalPages)} />
      </div>
    </div>
  );
}

function PaginationButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded-[7px] border border-zt-border bg-zt-bg-card text-xs text-zt-text-secondary flex items-center justify-center hover:bg-zt-bg-page disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  );
}

// ── ResultsPage ───────────────────────────────────────────────────────────────

/**
 * Global Results page (Befunde — alle Patienten).
 *
 * Architecture:
 *   ResultsPage
 *     → useResults (presentation hook)
 *       → ResultService (application service)
 *         → FhirResultRepository (infrastructure)
 *           → /api/diagnostic-reports (Next.js API route → FHIR server)
 *     → PatientSearchStrategySelector (application strategy)
 *     → PreviewModal, ResultList, SearchBar (presentation components)
 */
export default function ResultsPage() {
  const { t } = useTranslation();
  const { refreshCount } = useRefresh();

  const [modal, setModal] = useState<ModalState>(null);

  // Controlled search-form state (SearchBar debounces internally).
  const [patientInput, setPatientInput] = useState("");
  const [orderNumberInput, setOrderNumberInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { results, total, loading, error, page, pageSize, search, setPage, reload } =
    useResults({ pageSize: 20 });

  // Sync with global auto-refresh without re-running all effects.
  const prevRefreshCount = useRef(refreshCount);
  if (refreshCount !== prevRefreshCount.current) {
    prevRefreshCount.current = refreshCount;
    reload();
  }

  // ── Search handlers ─────────────────────────────────────────────────────

  const handlePatientSearch = useCallback(
    (input: string) => {
      setPatientInput(input);
      const params = patientSearchSelector.resolve(input);
      const orderNumber = orderNumberInput.trim() || undefined;
      search({
        ...params,
        ...(orderNumber  !== undefined && { orderNumber }),
        ...(statusFilter !== ""        && { status: statusFilter }),
      });
    },
    [orderNumberInput, statusFilter, search],
  );

  const handleOrderSearch = useCallback(
    (input: string) => {
      setOrderNumberInput(input);
      const patientParams = patientSearchSelector.resolve(patientInput);
      const orderNumber = input.trim() || undefined;
      search({
        ...patientParams,
        ...(orderNumber  !== undefined && { orderNumber }),
        ...(statusFilter !== ""        && { status: statusFilter }),
      });
    },
    [patientInput, statusFilter, search],
  );

  const handleStatusChange = useCallback(
    (status: string) => {
      setStatusFilter(status);
      const patientParams = patientSearchSelector.resolve(patientInput);
      const orderNumber = orderNumberInput.trim() || undefined;
      search({
        ...patientParams,
        ...(orderNumber !== undefined && { orderNumber }),
        ...(status      !== ""        && { status }),
      });
    },
    [patientInput, orderNumberInput, search],
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />
      <PreviewModal modal={modal} onClose={() => setModal(null)} />

      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[1200px] mx-auto">

          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-[12px] text-zt-text-tertiary" aria-label="Brotkrumen">
            <BackButton />
            <span className="text-zt-text-tertiary">|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("results.title")}</span>
          </nav>

          {/* Page header */}
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-[20px] font-medium text-zt-text-primary">{t("results.title")}</h1>
            <button
              onClick={reload}
              title={t("nav.refresh")}
              aria-label={t("nav.refresh")}
              className="h-8 w-8 flex items-center justify-center rounded-[8px] border border-zt-border bg-zt-bg-card text-zt-text-secondary hover:bg-zt-bg-page transition-colors text-base"
            >
              ↻
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <SearchBar
              placeholder={t("results.searchPatient")}
              value={patientInput}
              onChange={handlePatientSearch}
              icon="👤"
              className="w-56"
            />
            <SearchBar
              placeholder={t("results.searchOrder")}
              value={orderNumberInput}
              onChange={handleOrderSearch}
              icon="📋"
              className="w-48"
            />

            {/* Status filter chips */}
            <button
              onClick={() => handleStatusChange("")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                statusFilter === ""
                  ? "bg-zt-primary-light text-zt-primary border-zt-primary-border font-medium"
                  : "bg-zt-bg-card text-zt-text-secondary border-zt-border hover:bg-zt-bg-page"
              }`}
            >
              {t("results.allStatuses")}
            </button>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                  statusFilter === s
                    ? statusChipActiveClass(s)
                    : "bg-zt-bg-card text-zt-text-secondary border-zt-border hover:bg-zt-bg-page"
                }`}
              >
                {t(`befunde.status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
              </button>
            ))}
          </div>

          {/* Result count */}
          {!loading && !error && (
            <p className="mb-3 text-xs text-zt-text-tertiary">
              {total}{" "}
              {total === 1 ? t("results.resultSingular") : t("results.resultPlural")}
            </p>
          )}

          {/* Table wrapper */}
          <div className="bg-zt-bg-card border border-zt-border rounded-xl overflow-hidden">
            <ResultList
              results={results}
              loading={loading}
              error={error}
              t={t}
              onOpenModal={setModal}
              colCount={7}
            />

            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPage={setPage}
              t={t}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
