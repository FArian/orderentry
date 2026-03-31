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

interface Patient {
  id: string;
  name: string;
  address: string;
  createdAt: string;
}

const formatDate = (date: string) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

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

  const fetchPatients = useCallback(async (q: string, p: number) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ q, page: String(p), pageSize: String(pageSize) });
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
    const href = q ? `/patient?q=${encodeURIComponent(q)}` : "/patient";
    router.replace(href, { scroll: false });
    fetchPatients(q, 1);
  }, [fetchPatients, query, router]);

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
      const href = q ? `/patient?q=${encodeURIComponent(q)}` : "/patient";
      router.replace(href, { scroll: false });
      fetchPatients(q, 1);
    }, debounceMs);
    return () => {
      window.clearTimeout(debounceRef.current);
    };
  }, [query, fetchPatients, router]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const windowSize = 5;
  const visiblePages = useMemo(() => {
    if (total === 0) return [] as number[];
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - windowSize + 1);
    }
    const arr: number[] = [];
    for (let n = start; n <= end; n++) arr.push(n);
    return arr;
  }, [page, totalPages, total]);

  const content = useMemo(() => {
    const skeletonRow = (i: number) => (
      <DataTableRow key={`skeleton-${i}`} className="animate-pulse">
        <DataTableCell className="w-64">
          <div className="h-4 w-40 bg-gray-200 rounded" />
        </DataTableCell>
        <DataTableCell className="w-96">
          <div className="h-4 w-56 bg-gray-200 rounded" />
        </DataTableCell>
        <DataTableCell className="w-40">
          <div className="h-4 w-24 bg-gray-200 rounded" />
        </DataTableCell>
      </DataTableRow>
    );

    const fillerRow = (i: number, content?: React.ReactNode) => (
      <DataTableRow key={`placeholder-${i}`}>
        <DataTableCell className="text-gray-500" colSpan={3}>
          {content}
        </DataTableCell>
      </DataTableRow>
    );

    if (loading) {
      return Array.from({ length: pageSize }, (_, i) => skeletonRow(i));
    }

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

    const rows = items.map((patient) => (
      <DataTableRow
        key={patient.id}
        className="cursor-pointer hover:bg-blue-50 focus:bg-blue-100 outline-none"
        tabIndex={0}
        onClick={() => {
          if (patient.id) window.location.href = `/patient/${encodeURIComponent(patient.id)}`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (patient.id)
              window.location.href = `/patient/${encodeURIComponent(patient.id)}`;
          }
        }}
        role="button"
        aria-label={`Patient öffnen: ${patient.name}`}
      >
        <DataTableCell className="w-64" title={patient.name}>{truncate(patient.name, 20)}</DataTableCell>
        <DataTableCell className="w-96">{patient.address}</DataTableCell>
        <DataTableCell className="w-40">{formatDate(patient.createdAt)}</DataTableCell>
      </DataTableRow>
    ));
    return rows;
  }, [loading, error, items, t]);

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

      <h1 className="text-2xl font-bold mb-4">{t("patient.title")}</h1>

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
            <DataTableHeaderCell className="w-64">{t("patient.name")}</DataTableHeaderCell>
            <DataTableHeaderCell className="w-96">{t("patient.address")}</DataTableHeaderCell>
            <DataTableHeaderCell className="w-40">{t("patient.lastUpdated")}</DataTableHeaderCell>
          </DataTableHeadRow>
        </DataTableHead>
        <DataTableBody>{content}</DataTableBody>
      </DataTable>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {total > 0 ? (
            <span>
              {t("patient.showing")} {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} {t("patient.of")} {total}
            </span>
          ) : (
            <span>{t("patient.showing")} 0 {t("patient.of")} 0</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-2 py-1 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => { setPage(1); fetchPatients(query, 1); }}
            disabled={page <= 1 || loading}
          >
            {t("patient.first")}
          </button>

          <button
            className="rounded border px-2 py-1 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              const newPage = Math.max(1, page - 1);
              setPage(newPage);
              fetchPatients(query, newPage);
            }}
            disabled={page <= 1 || loading}
          >
            {t("patient.previous")}
          </button>

          {total > 0 && visiblePages.length > 0 && (
            <>
              {visiblePages[0] > 1 && <span className="px-1 text-gray-500">…</span>}
              {visiblePages.map((n) => (
                <button
                  key={n}
                  className={`rounded px-3 py-1 text-sm border cursor-pointer disabled:cursor-not-allowed ${
                    n === page ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"
                  }`}
                  onClick={() => { setPage(n); fetchPatients(query, n); }}
                  disabled={loading}
                >
                  {n}
                </button>
              ))}
              {visiblePages[visiblePages.length - 1] < totalPages && (
                <span className="px-1 text-gray-500">…</span>
              )}
            </>
          )}

          <button
            className="rounded border px-2 py-1 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              const newPage = Math.min(totalPages, page + 1);
              setPage(newPage);
              fetchPatients(query, newPage);
            }}
            disabled={page >= totalPages || loading}
          >
            {t("patient.next")}
          </button>

          <button
            className="rounded border px-2 py-1 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => { setPage(totalPages); fetchPatients(query, totalPages); }}
            disabled={page >= totalPages || loading}
          >
            {t("patient.last")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientPage() {
  return (
    <Suspense fallback={<div className="p-4 text-gray-500">…</div>}>
      <PatientPageContent />
    </Suspense>
  );
}
