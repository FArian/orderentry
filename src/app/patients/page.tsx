"use client";

import type React from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/shared/utils/formatDate";
import { AppSidebar } from "@/components/AppSidebar";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  name: string;
  address: string;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const truncate = (text: string, max: number) =>
  text && text.length > max ? `${text.slice(0, max)}…` : text;

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Deterministic avatar color from patient index
const AVATAR_COLORS = [
  "bg-zt-primary-light text-zt-primary",
  "bg-[#FBEAF0] text-[#993556]",
  "bg-[#E1F5EE] text-[#0F6E56]",
  "bg-[#FAEEDA] text-[#854F0B]",
];
function avatarColor(idx: number): string {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length]!;
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  loading,
  onPage,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  t,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPage: (p: number) => void;
  t: (k: string) => string;
}) {
  const pageNums = useMemo(() => {
    if (totalPages <= 1) return [] as number[];
    const w = 5;
    let start = Math.max(1, page - Math.floor(w / 2));
    let end = start + w - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - w + 1); }
    const arr: number[] = [];
    for (let n = start; n <= end; n++) arr.push(n);
    return arr;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <PageBtn label="«" disabled={page <= 1 || loading} onClick={() => onPage(1)} />
      <PageBtn label="‹" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)} />
      {(pageNums[0] ?? 1) > 1 && <span className="px-1 text-xs text-zt-text-tertiary">…</span>}
      {pageNums.map((n) => (
        <button
          key={n}
          onClick={() => onPage(n)}
          disabled={loading}
          className={`w-7 h-7 rounded-[7px] border text-xs flex items-center justify-center transition-colors ${
            n === page
              ? "bg-zt-primary text-zt-text-on-primary border-zt-primary"
              : "bg-zt-bg-card border-zt-border text-zt-text-secondary hover:bg-zt-bg-page"
          }`}
        >
          {n}
        </button>
      ))}
      {(pageNums[pageNums.length - 1] ?? totalPages) < totalPages && (
        <span className="px-1 text-xs text-zt-text-tertiary">…</span>
      )}
      <PageBtn label="›" disabled={page >= totalPages || loading} onClick={() => onPage(page + 1)} />
      <PageBtn label="»" disabled={page >= totalPages || loading} onClick={() => onPage(totalPages)} />
    </div>
  );
}

function PageBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
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

// ── Main page content ─────────────────────────────────────────────────────────

function PatientPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [query, setQuery]               = useState("");
  const [items, setItems]               = useState<Patient[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [page, setPage]                 = useState(1);
  const pageSize                        = 20;
  const [total, setTotal]               = useState(0);
  const debounceRef                     = useRef<number | undefined>(undefined);
  const initializedRef                  = useRef(false);

  // Active / inactive toggle
  type FilterMode = "active" | "inactive" | "all";
  const [filterMode, setFilterMode]     = useState<FilterMode>("active");

  // Activate single patient
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateMsg, setActivateMsg]   = useState<string | null>(null);

  // Merge state
  const [mergeMode, setMergeMode]       = useState(false);
  const [mergeSelected, setMergeSelected] = useState<Patient[]>([]);
  const [merging, setMerging]           = useState(false);
  const [mergeMsg, setMergeMsg]         = useState<string | null>(null);
  const [mergeErr, setMergeErr]         = useState<string | null>(null);

  const showInactive = filterMode === "inactive";
  const totalPages   = Math.max(1, Math.ceil(total / pageSize));

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPatients = useCallback(async (q: string, p: number, inactive = false) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ q, page: String(p), pageSize: String(pageSize) });
      if (inactive) params.set("showInactive", "true");
      const res = await fetch(`/api/patients?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json() as { data: Patient[]; total: number; page: number; pageSize: number };
      setItems(data.data);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("patient.loadError"));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const initialQ = (searchParams?.get("q") || "").toString();
    setQuery(initialQ);
    fetchPatients(initialQ, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (!initializedRef.current) { initializedRef.current = true; return; }
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setPage(1);
      const q = query.trim();
      router.replace(q ? `/patients?q=${encodeURIComponent(q)}` : "/patients", { scroll: false });
      fetchPatients(q, 1, showInactive);
    }, 400);
    return () => { window.clearTimeout(debounceRef.current); };
  }, [query, fetchPatients, router, showInactive]);

  function goPage(p: number) {
    setPage(p);
    fetchPatients(query.trim(), p, showInactive);
  }

  function applyFilter(mode: FilterMode) {
    setFilterMode(mode);
    setPage(1);
    fetchPatients(query.trim(), 1, mode === "inactive");
  }

  // ── Merge ──────────────────────────────────────────────────────────────────

  function toggleMergeSelect(patient: Patient) {
    setMergeSelected((prev) => {
      const already = prev.find((p) => p.id === patient.id);
      if (already) return prev.filter((p) => p.id !== patient.id);
      if (prev.length >= 2) return prev;
      return [...prev, patient];
    });
  }

  async function executeMerge() {
    if (mergeSelected.length !== 2) return;
    setMerging(true);
    setMergeMsg(null);
    setMergeErr(null);
    const [target, source] = mergeSelected as [Patient, Patient];
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(target.id)}/merge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: source.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || String(res.status));
      setMergeMsg(t("patient.mergeOk"));
      setMergeSelected([]);
      setMergeMode(false);
      fetchPatients(query, page, showInactive);
    } catch (e: unknown) {
      setMergeErr(e instanceof Error ? e.message : String(e));
    } finally {
      setMerging(false);
    }
  }

  async function activatePatient(patientId: string) {
    setActivatingId(patientId);
    setActivateMsg(null);
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/activate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || String(res.status));
      setActivateMsg(t("patient.activateOk"));
      fetchPatients(query, page, showInactive);
    } catch (e: unknown) {
      setActivateMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setActivatingId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  return (
    <div
      className="flex overflow-hidden"
      style={{ height: "calc(100vh - var(--zt-topbar-height))" }}
    >
      <AppSidebar />

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-7">

        {/* Breadcrumb */}
        <nav className="mb-3.5 flex items-center gap-1.5 text-xs text-zt-text-tertiary" aria-label="Brotkrumen">
          <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
          <span>/</span>
          <span className="text-zt-text-primary">{t("patient.title")}</span>
        </nav>

        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-medium text-zt-text-primary">{t("patient.title")}</h1>
          <div className="flex items-center gap-2">
            {/* New patient — not implemented yet, placeholder */}
            <button
              type="button"
              className="h-8 flex items-center gap-1.5 px-3 rounded-[8px] border border-zt-border bg-zt-bg-card text-[13px] text-zt-text-primary hover:bg-zt-bg-page transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {t("patient.title")}
            </button>

            {/* Merge patients toggle */}
            {!showInactive && (
              <button
                type="button"
                onClick={() => { setMergeMode((m) => !m); setMergeSelected([]); setMergeMsg(null); setMergeErr(null); }}
                className={`h-8 flex items-center gap-1.5 px-3 rounded-[8px] border text-[13px] transition-colors ${
                  mergeMode
                    ? "bg-[#FAEEDA] text-[#854F0B] border-[#FAC775]"
                    : "border-zt-border bg-zt-bg-card text-zt-text-primary hover:bg-zt-bg-page"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <circle cx="4.5" cy="4.5" r="3" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 7l3 3" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
                {mergeMode ? t("patient.mergeModeOn") : t("patient.mergeMode")}
              </button>
            )}

            {/* New order — goes to patient search */}
            <Link
              href="/patients"
              className="h-8 flex items-center gap-1.5 px-3 rounded-[8px] bg-zt-primary text-[13px] font-medium text-zt-text-on-primary hover:bg-zt-primary-hover transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <rect x="0.5" y="0.5" width="11" height="11" rx="1.5" stroke="white" strokeWidth="1"/>
                <path d="M4 6h4M6 4v4" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {t("dashboard.newOrder")}
            </Link>
          </div>
        </div>

        {/* Merge banner */}
        {mergeMode && (
          <div className="mb-4 flex flex-col gap-1.5 rounded-xl border border-[#FAC775] bg-[#FAEEDA] px-4 py-3 text-sm text-[#854F0B]">
            <p className="font-medium">{t("patient.mergeHint")}</p>
            {mergeSelected.length === 0 && (
              <p className="text-xs">{t("patient.mergeSelectFirst")}</p>
            )}
            {mergeSelected.length === 1 && (
              <p className="text-xs">→ <strong>{mergeSelected[0]!.name}</strong> {t("patient.mergeSelectSecond")}</p>
            )}
            {mergeSelected.length === 2 && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs">
                  <strong>{mergeSelected[1]!.name}</strong> → <strong>{mergeSelected[0]!.name}</strong>
                </span>
                <button
                  onClick={executeMerge}
                  disabled={merging}
                  className="px-3 py-1 rounded-[7px] bg-[#854F0B] text-white text-xs hover:opacity-90 disabled:opacity-50"
                >
                  {merging ? t("common.saving") : t("patient.mergeConfirm")}
                </button>
                <button
                  onClick={() => setMergeSelected([])}
                  className="px-3 py-1 rounded-[7px] bg-zt-bg-card border border-zt-border text-xs text-zt-text-primary hover:bg-zt-bg-page"
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
            {mergeMsg && <p className="text-xs text-zt-success">{mergeMsg}</p>}
            {mergeErr && <p className="text-xs text-zt-danger">{mergeErr}</p>}
          </div>
        )}

        {/* Activate feedback */}
        {activateMsg && (
          <div className="mb-4 rounded-xl border border-zt-success-border bg-zt-success-light px-4 py-2.5 text-sm text-zt-success">
            {activateMsg}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2.5 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-[360px]">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zt-text-tertiary pointer-events-none"
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
            >
              <circle cx="5.5" cy="5.5" r="4"/>
              <path d="M9 9l3 3"/>
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { window.clearTimeout(debounceRef.current); fetchPatients(query.trim(), 1, showInactive); }}}
              placeholder={t("patient.searchPlaceholder")}
              className="w-full pl-9 pr-3 py-2 rounded-[8px] border border-zt-border bg-zt-bg-card text-[13px] text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary"
            />
          </div>

          {/* Filter chips */}
          <button
            type="button"
            onClick={() => applyFilter("active")}
            className={`flex items-center gap-1 text-xs px-2.5 py-[5px] rounded-full border transition-colors ${
              filterMode === "active"
                ? "bg-zt-primary-light text-zt-primary border-zt-primary-border"
                : "bg-zt-bg-card text-zt-text-secondary border-zt-border hover:bg-zt-bg-page"
            }`}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor" aria-hidden="true">
              <circle cx="4.5" cy="4.5" r="4"/>
            </svg>
            {t("patient.showInactive").replace("anzeigen", "").trim() || "Aktiv"}
            {filterMode === "active" ? "" : ""}
            {/* Use static labels since i18n keys don't have short active/inactive labels */}
            {filterMode !== "active" ? "" : ""}
          </button>
          <button
            type="button"
            onClick={() => applyFilter("inactive")}
            className={`text-xs px-2.5 py-[5px] rounded-full border transition-colors ${
              filterMode === "inactive"
                ? "bg-zt-primary-light text-zt-primary border-zt-primary-border"
                : "bg-zt-bg-card text-zt-text-secondary border-zt-border hover:bg-zt-bg-page"
            }`}
          >
            {t("patient.showActive").replace("anzeigen", "").trim() || "Inaktiv"}
          </button>
          <button
            type="button"
            onClick={() => applyFilter("all")}
            className={`text-xs px-2.5 py-[5px] rounded-full border transition-colors ${
              filterMode === "all"
                ? "bg-zt-primary-light text-zt-primary border-zt-primary-border"
                : "bg-zt-bg-card text-zt-text-secondary border-zt-border hover:bg-zt-bg-page"
            }`}
          >
            Alle
          </button>

          {/* Results count — right-aligned */}
          {!loading && (
            <span className="ml-auto text-xs text-zt-text-tertiary">
              {total} {total === 1 ? t("patient.name") : t("patient.title")}
            </span>
          )}
          {loading && (
            <span className="ml-auto text-xs text-zt-text-tertiary">{t("common.loading")}</span>
          )}
        </div>

        {/* Table */}
        <div className="bg-zt-bg-card border border-zt-border rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-zt-bg-page">
                {mergeMode && (
                  <th className="w-10 px-4 py-2.5 text-left border-b border-zt-border" />
                )}
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-zt-text-secondary uppercase tracking-wide border-b border-zt-border cursor-pointer hover:text-zt-text-primary whitespace-nowrap">
                  {t("patient.name")} ↕
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-zt-text-secondary uppercase tracking-wide border-b border-zt-border cursor-pointer hover:text-zt-text-primary">
                  {t("patient.address")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-zt-text-secondary uppercase tracking-wide border-b border-zt-border cursor-pointer hover:text-zt-text-primary whitespace-nowrap">
                  {t("patient.lastUpdated")} ↓
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-zt-text-secondary uppercase tracking-wide border-b border-zt-border">
                  {t("orders.title")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-zt-text-secondary uppercase tracking-wide border-b border-zt-border">
                  {t("orders.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Skeleton */}
              {loading && Array.from({ length: 8 }, (_, i) => (
                <tr key={`sk-${i}`} className="border-b border-zt-border last:border-b-0 animate-pulse">
                  {mergeMode && <td className="px-4 py-3 w-10" />}
                  <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-zt-bg-muted shrink-0" /><div><div className="h-3 w-32 bg-zt-bg-muted rounded mb-1" /><div className="h-2.5 w-20 bg-zt-bg-muted rounded" /></div></div></td>
                  <td className="px-4 py-3"><div className="h-3 w-48 bg-zt-bg-muted rounded" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-20 bg-zt-bg-muted rounded" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-16 bg-zt-bg-muted rounded-full" /></td>
                  <td className="px-4 py-3"><div className="flex gap-1.5"><div className="h-6 w-14 bg-zt-bg-muted rounded-lg" /><div className="h-6 w-14 bg-zt-bg-muted rounded-lg" /></div></td>
                </tr>
              ))}

              {/* Error */}
              {!loading && error && (
                <tr>
                  <td colSpan={mergeMode ? 6 : 5} className="px-4 py-8 text-center text-sm text-zt-danger">
                    {error}
                  </td>
                </tr>
              )}

              {/* Empty */}
              {!loading && !error && items.length === 0 && (
                <tr>
                  <td colSpan={mergeMode ? 6 : 5} className="px-4 py-12 text-center text-sm text-zt-text-tertiary">
                    {t("patient.noResults")}
                  </td>
                </tr>
              )}

              {/* Rows */}
              {!loading && !error && items.map((patient, idx) => {
                const isSelected = mergeSelected.some((p) => p.id === patient.id);
                const selIdx     = mergeSelected.findIndex((p) => p.id === patient.id);
                return (
                  <tr
                    key={patient.id}
                    className={`border-b border-zt-border last:border-b-0 cursor-pointer transition-colors ${
                      mergeMode
                        ? isSelected
                          ? "bg-[#FAEEDA] hover:bg-[#FAE0C0]"
                          : "hover:bg-zt-bg-page"
                        : "hover:bg-zt-bg-page"
                    }`}
                    onClick={() => {
                      if (mergeMode) {
                        toggleMergeSelect(patient);
                      } else {
                        window.location.href = `/patient/${encodeURIComponent(patient.id)}`;
                      }
                    }}
                  >
                    {/* Merge checkbox */}
                    {mergeMode && (
                      <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleMergeSelect(patient)}
                          disabled={!isSelected && mergeSelected.length >= 2}
                          className="cursor-pointer accent-zt-primary"
                        />
                        {isSelected && (
                          <span className="ml-1 text-xs font-bold text-[#854F0B]">
                            {selIdx === 0 ? "→" : "×"}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Patient name + DOB */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${avatarColor(idx)}`}
                          aria-hidden="true"
                        >
                          {nameInitials(patient.name)}
                        </div>
                        <div>
                          <div className="text-[13px] font-medium text-zt-text-primary">
                            {truncate(patient.name, 28)}
                          </div>
                          <div className="text-[11px] text-zt-text-secondary mt-0.5">
                            {formatDate(patient.createdAt) ? `${t("patient.lastUpdated")}: ${formatDate(patient.createdAt)}` : "—"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Address */}
                    <td className="px-4 py-3 text-[13px] text-zt-text-secondary max-w-xs truncate">
                      {patient.address || "—"}
                    </td>

                    {/* Last updated */}
                    <td className="px-4 py-3 text-xs text-zt-text-tertiary whitespace-nowrap">
                      {formatDate(patient.createdAt) || "—"}
                    </td>

                    {/* Orders count badge */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-zt-text-secondary bg-zt-bg-page px-2 py-1 rounded-full border border-zt-border">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                          <rect x="1" y="1" width="8" height="8" rx="1"/>
                        </svg>
                        —
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {showInactive ? (
                          <button
                            onClick={() => activatePatient(patient.id)}
                            disabled={activatingId === patient.id}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-zt-success-light text-zt-success border border-zt-success-border hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                          >
                            {activatingId === patient.id ? t("common.saving") : t("patient.activate")}
                          </button>
                        ) : (
                          <>
                            <Link
                              href={`/patient/${encodeURIComponent(patient.id)}`}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-zt-primary-light text-zt-primary border border-zt-primary-border hover:bg-zt-primary hover:text-zt-text-on-primary transition-colors whitespace-nowrap"
                            >
                              {t("orders.title")}
                            </Link>
                            <Link
                              href={`/patient/${encodeURIComponent(patient.id)}/befunde`}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-zt-success-light text-zt-success border border-zt-success-border hover:bg-zt-success hover:text-zt-text-on-success transition-colors whitespace-nowrap"
                            >
                              {t("befunde.title")}
                            </Link>
                            <button
                              type="button"
                              onClick={() => { window.location.href = `/patient/${encodeURIComponent(patient.id)}`; }}
                              className="w-7 h-7 rounded-[6px] border border-zt-border bg-zt-bg-card flex items-center justify-center hover:bg-zt-bg-page transition-colors"
                              aria-label={t("common.edit")}
                            >
                              <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
                                <circle cx="2.5" cy="6.5" r="1.2"/>
                                <circle cx="6.5" cy="6.5" r="1.2"/>
                                <circle cx="10.5" cy="6.5" r="1.2"/>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Table footer */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zt-border bg-zt-bg-page">
              <span className="text-xs text-zt-text-tertiary">
                {t("patient.showing")} {from}–{to} {t("patient.of")} {total}
              </span>
              <Pagination
                page={page}
                totalPages={totalPages}
                loading={loading}
                onPage={goPage}
                t={t}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center text-sm text-zt-text-tertiary"
        style={{ height: "calc(100vh - var(--zt-topbar-height))" }}>
        …
      </div>
    }>
      <PatientPageContent />
    </Suspense>
  );
}
