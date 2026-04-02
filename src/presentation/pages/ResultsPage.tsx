"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useResults } from "@/presentation/hooks/useResults";
import { ResultList } from "@/presentation/components/ResultList";
import { SearchBar } from "@/presentation/components/SearchBar";
import { PreviewModal } from "@/presentation/components/PreviewModal";
import { patientSearchSelector } from "@/application/strategies/PatientSearchStrategy";
import { useTranslation } from "@/lib/i18n";
import { useRefresh } from "@/lib/refresh";
import type { ModalState } from "@/presentation/components/PreviewModal";

// ── Status filter options (all FHIR DiagnosticReport statuses) ────────────────

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
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>
        {t("patient.showing")} {from}–{to} {t("patient.of")} {total}
      </span>
      <div className="flex items-center gap-1.5">
        <PaginationButton label={t("patient.first")}    disabled={page <= 1}            onClick={() => onPage(1)} />
        <PaginationButton label={t("patient.previous")} disabled={page <= 1}            onClick={() => onPage(page - 1)} />
        <span className="px-2">
          {t("patient.page")} {page} {t("patient.of")} {totalPages}
        </span>
        <PaginationButton label={t("patient.next")}     disabled={page >= totalPages}   onClick={() => onPage(page + 1)} />
        <PaginationButton label={t("patient.last")}     disabled={page >= totalPages}   onClick={() => onPage(totalPages)} />
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
      className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-100 disabled:opacity-40"
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

  /** Debounced patient search — delegates ID vs. name detection to Strategy. */
  const handlePatientSearch = useCallback(
    (input: string) => {
      setPatientInput(input);
      const params = patientSearchSelector.resolve(input);
      const orderNumber = orderNumberInput.trim() || undefined;
      search({
        ...params,
        ...(orderNumber   !== undefined && { orderNumber }),
        ...(statusFilter  !== ""        && { status: statusFilter }),
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
        ...(orderNumber   !== undefined && { orderNumber }),
        ...(statusFilter  !== ""        && { status: statusFilter }),
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
    <div className="p-4">
      <PreviewModal modal={modal} onClose={() => setModal(null)} />

      {/* Breadcrumb */}
      <nav className="mb-2 text-sm text-gray-600" aria-label="Brotkrumen">
        <ol className="flex items-center gap-2">
          <li>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              title={t("nav.home")}
            >
              🏠 {t("nav.home")}
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-700">{t("results.title")}</li>
        </ol>
      </nav>

      {/* Header + search toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold">{t("results.title")}</h1>

        <div className="flex flex-wrap items-center gap-2">
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
          <StatusSelect
            value={statusFilter}
            onChange={handleStatusChange}
            t={t}
          />
          <button
            onClick={reload}
            title={t("nav.refresh")}
            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-gray-600 hover:bg-gray-100 text-sm"
            aria-label={t("nav.refresh")}
          >
            ↻
          </button>
        </div>
      </div>

      {/* Result count */}
      {!loading && !error && (
        <p className="mb-2 text-xs text-gray-500">
          {total}{" "}
          {total === 1 ? t("results.resultSingular") : t("results.resultPlural")}
        </p>
      )}

      {/* Table */}
      <ResultList
        results={results}
        loading={loading}
        error={error}
        t={t}
        onOpenModal={setModal}
        colCount={7}
      />

      {/* Pagination */}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPage={setPage}
        t={t}
      />
    </div>
  );
}

// ── Extracted sub-component ───────────────────────────────────────────────────

function StatusSelect({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  t: (k: string) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
    >
      <option value="">{t("results.allStatuses")}</option>
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {t(`befunde.status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
        </option>
      ))}
    </select>
  );
}
