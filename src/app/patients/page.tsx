"use client";

import type React from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { formatDate } from "@/shared/utils/formatDate";

interface Patient {
  id: string;
  name: string;
  address: string;
  createdAt: string;
}

const truncate = (text: string, max: number) =>
  text && text.length > max ? `${text.slice(0, max)}...` : text;

function PatientPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const debounceRef = useRef<number | undefined>(undefined);
  const initializedRef = useRef(false);
  const debounceMs = 400;

  // Show inactive toggle
  const [showInactive, setShowInactive] = useState(false);

  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateMsg, setActivateMsg] = useState<string | null>(null);

  // Merge state
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<Patient[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeMsg, setMergeMsg] = useState<string | null>(null);
  const [mergeErr, setMergeErr] = useState<string | null>(null);

  const fetchPatients = useCallback(async (q: string, p: number, inactive = false) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ q, page: String(p), pageSize: String(pageSize) });
      if (inactive) params.set("showInactive", "true");
      const res = await fetch(`/api/patients?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as { data: Patient[]; total: number; page: number; pageSize: number };
      setItems(data.data);
      setTotal(data.total);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || t("patient.loadError"));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const initialQ = (searchParams?.get("q") || "").toString();
    setQuery(initialQ);
    fetchPatients(initialQ, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = useCallback(() => {
    setPage(1);
    const q = query.trim();
    const href = q ? `/patients?q=${encodeURIComponent(q)}` : "/patients";
    router.replace(href, { scroll: false });
    fetchPatients(q, 1, showInactive);
  }, [fetchPatients, query, router, showInactive]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") onSearch();
    },
    [onSearch]
  );

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setPage(1);
      const q = query.trim();
      const href = q ? `/patients?q=${encodeURIComponent(q)}` : "/patients";
      router.replace(href, { scroll: false });
      fetchPatients(q, 1, showInactive);
    }, debounceMs);
    return () => { window.clearTimeout(debounceRef.current); };
  }, [query, fetchPatients, router, showInactive]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const windowSize = 5;
  const visiblePages = useMemo(() => {
    if (total === 0) return [] as number[];
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - windowSize + 1); }
    const arr: number[] = [];
    for (let n = start; n <= end; n++) arr.push(n);
    return arr;
  }, [page, totalPages, total]);

  // ── Merge helpers ────────────────────────────────────────────────────────
  function toggleMergeSelect(patient: Patient) {
    setMergeSelected((prev) => {
      const already = prev.find((p) => p.id === patient.id);
      if (already) return prev.filter((p) => p.id !== patient.id);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, patient];
    });
  }

  async function executeMerge() {
    if (mergeSelected.length !== 2) return;
    setMerging(true);
    setMergeMsg(null);
    setMergeErr(null);
    const [target, source] = mergeSelected; // first selected = merge target (survives)
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
      const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/activate`, {
        method: "POST",
      });
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

  const content = useMemo(() => {
    const colCount = mergeMode ? 5 : 4;

    const skeletonRow = (i: number) => (
      <DataTableRow key={`skeleton-${i}`} className="animate-pulse">
        {mergeMode && <DataTableCell className="w-10">{" "}</DataTableCell>}
        <DataTableCell className="w-64"><div className="h-4 w-40 bg-gray-200 rounded" /></DataTableCell>
        <DataTableCell className="w-96"><div className="h-4 w-56 bg-gray-200 rounded" /></DataTableCell>
        <DataTableCell className="w-40"><div className="h-4 w-24 bg-gray-200 rounded" /></DataTableCell>
        <DataTableCell className="w-48">{" "}</DataTableCell>
      </DataTableRow>
    );

    const fillerRow = (i: number, content?: React.ReactNode) => (
      <DataTableRow key={`placeholder-${i}`}>
        <DataTableCell className="text-gray-500" colSpan={colCount}>{content}</DataTableCell>
      </DataTableRow>
    );

    if (loading) return Array.from({ length: pageSize }, (_, i) => skeletonRow(i));
    if (error) {
      const rows = [fillerRow(0, error)];
      for (let i = 1; i < pageSize; i++) rows.push(fillerRow(i));
      return rows;
    }
    if (items.length === 0) {
      const rows = [fillerRow(0, t("patient.noResults"))];
      for (let i = 1; i < pageSize; i++) rows.push(fillerRow(i));
      return rows;
    }

    return items.map((patient) => {
      const isSelected = mergeSelected.some((p) => p.id === patient.id);
      const selIdx = mergeSelected.findIndex((p) => p.id === patient.id);
      return (
        <DataTableRow
          key={patient.id}
          className={`cursor-pointer outline-none ${
            mergeMode
              ? isSelected
                ? "bg-amber-50 hover:bg-amber-100"
                : "hover:bg-blue-50"
              : "hover:bg-blue-50 focus:bg-blue-100"
          }`}
          tabIndex={0}
          onClick={() => {
            if (mergeMode) {
              toggleMergeSelect(patient);
            } else if (patient.id) {
              window.location.href = `/patient/${encodeURIComponent(patient.id)}`;
            }
          }}
          role="button"
          aria-label={`Patient: ${patient.name}`}
        >
          {mergeMode && (
            <DataTableCell className="w-10" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleMergeSelect(patient)}
                disabled={!isSelected && mergeSelected.length >= 2}
                className="cursor-pointer"
              />
              {isSelected && (
                <span className="ml-1 text-xs font-bold text-amber-700">
                  {selIdx === 0 ? "→" : "×"}
                </span>
              )}
            </DataTableCell>
          )}
          <DataTableCell className="w-64" title={patient.name}>{truncate(patient.name, 20)}</DataTableCell>
          <DataTableCell className="w-96">{patient.address}</DataTableCell>
          <DataTableCell className="w-40">{formatDate(patient.createdAt)}</DataTableCell>
          <DataTableCell className="w-48">
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {showInactive ? (
                <button
                  onClick={() => activatePatient(patient.id)}
                  disabled={activatingId === patient.id}
                  className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                >
                  ✅ {activatingId === patient.id ? t("common.saving") : t("patient.activate")}
                </button>
              ) : (
                <>
                  <Link
                    href={`/patient/${encodeURIComponent(patient.id)}`}
                    className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                  >
                    📋 {t("orders.title")}
                  </Link>
                  <Link
                    href={`/patient/${encodeURIComponent(patient.id)}/befunde`}
                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                  >
                    🔬 {t("befunde.title")}
                  </Link>
                </>
              )}
            </div>
          </DataTableCell>
        </DataTableRow>
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, items, t, mergeMode, mergeSelected, showInactive, activatingId]);

  return (
    <div className="p-4">
      <nav className="mb-2 text-sm text-gray-600" aria-label="Brotkrumen">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
              🏠 {t("nav.home")}
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-700">{t("patient.title")}</li>
        </ol>
      </nav>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("patient.title")}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !showInactive;
              setShowInactive(next);
              setPage(1);
              setActivateMsg(null);
              fetchPatients(query, 1, next);
            }}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              showInactive
                ? "bg-red-100 text-red-800 hover:bg-red-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {showInactive ? `👁 ${t("patient.showActive")}` : `👁 ${t("patient.showInactive")}`}
          </button>
          {!showInactive && (
            <button
              onClick={() => { setMergeMode((m) => !m); setMergeSelected([]); setMergeMsg(null); setMergeErr(null); }}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                mergeMode
                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              🔀 {mergeMode ? t("patient.mergeModeOn") : t("patient.mergeMode")}
            </button>
          )}
        </div>
      </div>

      {activateMsg && (
        <div className="mb-3 rounded border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
          {activateMsg}
        </div>
      )}

      {/* Merge banner */}
      {mergeMode && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium mb-1">{t("patient.mergeHint")}</p>
          {mergeSelected.length === 0 && <p className="text-xs">{t("patient.mergeSelectFirst")}</p>}
          {mergeSelected.length === 1 && (
            <p className="text-xs">
              → <strong>{mergeSelected[0].name}</strong> {t("patient.mergeSelectSecond")}
            </p>
          )}
          {mergeSelected.length === 2 && (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs">
                <strong>{mergeSelected[1].name}</strong> → <strong>{mergeSelected[0].name}</strong>
              </span>
              <button
                onClick={executeMerge}
                disabled={merging}
                className="px-3 py-1 rounded bg-amber-600 text-white text-xs hover:bg-amber-700 disabled:opacity-50"
              >
                {merging ? t("common.saving") : t("patient.mergeConfirm")}
              </button>
              <button
                onClick={() => setMergeSelected([])}
                className="px-3 py-1 rounded bg-white border text-xs hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
            </div>
          )}
          {mergeMsg && <p className="mt-2 text-xs text-green-700">{mergeMsg}</p>}
          {mergeErr && <p className="mt-2 text-xs text-red-600">{mergeErr}</p>}
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("patient.searchPlaceholder")}
          className="w-full max-w-md rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={onSearch}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? t("common.searching") : t("common.search")}
        </button>
      </div>

      <DataTable>
        <DataTableHead>
          <DataTableHeadRow>
            {mergeMode && <DataTableHeaderCell className="w-10">{" "}</DataTableHeaderCell>}
            <DataTableHeaderCell className="w-64">{t("patient.name")}</DataTableHeaderCell>
            <DataTableHeaderCell className="w-96">{t("patient.address")}</DataTableHeaderCell>
            <DataTableHeaderCell className="w-40">{t("patient.lastUpdated")}</DataTableHeaderCell>
            <DataTableHeaderCell className="w-48">{t("orders.actions")}</DataTableHeaderCell>
          </DataTableHeadRow>
        </DataTableHead>
        <DataTableBody>{content}</DataTableBody>
      </DataTable>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {total > 0 ? (
            <span>{t("patient.showing")} {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} {t("patient.of")} {total}</span>
          ) : (
            <span>{t("patient.showing")} 0 {t("patient.of")} 0</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded border px-2 py-1 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => { setPage(1); fetchPatients(query, 1, showInactive); }} disabled={page <= 1 || loading}>{t("patient.first")}</button>
          <button className="rounded border px-2 py-1 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => { const n = Math.max(1, page - 1); setPage(n); fetchPatients(query, n, showInactive); }} disabled={page <= 1 || loading}>{t("patient.previous")}</button>
          {total > 0 && visiblePages.length > 0 && (
            <>
              {visiblePages[0] > 1 && <span className="px-1 text-gray-500">…</span>}
              {visiblePages.map((n) => (
                <button key={n} className={`rounded px-3 py-1 text-sm border cursor-pointer ${n === page ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`} onClick={() => { setPage(n); fetchPatients(query, n, showInactive); }} disabled={loading}>{n}</button>
              ))}
              {visiblePages[visiblePages.length - 1] < totalPages && <span className="px-1 text-gray-500">…</span>}
            </>
          )}
          <button className="rounded border px-2 py-1 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => { const n = Math.min(totalPages, page + 1); setPage(n); fetchPatients(query, n, showInactive); }} disabled={page >= totalPages || loading}>{t("patient.next")}</button>
          <button className="rounded border px-2 py-1 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => { setPage(totalPages); fetchPatients(query, totalPages, showInactive); }} disabled={page >= totalPages || loading}>{t("patient.last")}</button>
        </div>
      </div>
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-gray-500">…</div>}>
      <PatientPageContent />
    </Suspense>
  );
}
