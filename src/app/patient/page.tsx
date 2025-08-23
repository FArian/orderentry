"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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

export default function PatientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      setError(message || "Failed to load patients");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // initial load honoring URL query (?q=...)
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

  // Debounced search on typing
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
      <tr key={`skeleton-${i}`} className="odd:bg-white even:bg-gray-50 animate-pulse h-14">
        <td className="w-64 px-6 py-0 align-middle truncate">
          <div className="h-4 w-40 bg-gray-200 rounded" />
        </td>
        <td className="w-96 px-6 py-0 align-middle truncate">
          <div className="h-4 w-56 bg-gray-200 rounded" />
        </td>
        <td className="w-40 px-6 py-0 align-middle truncate">
          <div className="h-4 w-24 bg-gray-200 rounded" />
        </td>
      </tr>
    );

    const fillerRow = (i: number, content?: React.ReactNode) => (
      <tr key={`placeholder-${i}`} className="odd:bg-white even:bg-gray-50 h-14">
        {content ? (
          <td className="px-6 py-0 text-gray-500 align-middle" colSpan={3}>
            {content}
          </td>
        ) : (
          <>
            <td className="w-64 px-6 py-0 whitespace-nowrap align-middle">&nbsp;</td>
            <td className="w-96 px-6 py-0 whitespace-nowrap align-middle">&nbsp;</td>
            <td className="w-40 px-6 py-0 whitespace-nowrap align-middle">&nbsp;</td>
          </>
        )}
      </tr>
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
      const rows = [fillerRow(0, "No patients found")];
      for (let i = 1; i < pageSize; i++) rows.push(fillerRow(i));
      return rows;
    }

    const rows = items.map((patient) => (
      <tr
        key={patient.id}
        className="odd:bg-white even:bg-gray-50 h-14 cursor-pointer hover:bg-blue-50 focus:bg-blue-100 outline-none"
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
        <td className="w-64 px-6 py-0 align-middle truncate" title={patient.name}>{truncate(patient.name, 20)}</td>
        <td className="w-96 px-6 py-0 align-middle truncate">{patient.address}</td>
        <td className="w-40 px-6 py-0 align-middle truncate">{formatDate(patient.createdAt)}</td>
      </tr>
    ));
    // Pad with empty rows to maintain consistent height
    for (let i = items.length; i < pageSize; i++) rows.push(fillerRow(i));
    return rows;
  }, [loading, error, items]);

  return (
    <div className="p-4">
      {/* Breadcrumb */}
      <nav className="mb-2 text-sm text-gray-600" aria-label="Brotkrumen">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="text-blue-600 hover:underline">
              Startseite
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-700">Patienten</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold mb-4">Patienten</h1>

      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Nach Name oder Adresse suchen"
          className="w-full max-w-md rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={onSearch}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          Suchen
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-gray-200">
          <thead className="border-b border-gray-200">
            <tr>
              <th
                scope="col"
                className="sticky top-0 z-20 w-64 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-white/85 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm"
              >
                Name
              </th>
              <th
                scope="col"
                className="sticky top-0 z-20 w-96 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-white/85 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm"
              >
                Adresse
              </th>
              <th
                scope="col"
                className="sticky top-0 z-20 w-40 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-white/85 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm"
              >
                Erstellungsdatum
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">{content}</tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {total > 0 ? (
            <span>
              Zeige {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} von {total}
            </span>
          ) : (
            <span>Zeige 0 von 0</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-2 py-1 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              setPage(1);
              fetchPatients(query, 1);
            }}
            disabled={page <= 1 || loading}
          >
            Erste
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
            Zurück
          </button>

          {total > 0 && visiblePages.length > 0 && (
            <>
              {/* Leading ellipsis if we are skipping pages */}
              {visiblePages[0] > 1 && <span className="px-1 text-gray-500">…</span>}
              {visiblePages.map((n) => (
                <button
                  key={n}
                  className={`rounded px-3 py-1 text-sm border cursor-pointer disabled:cursor-not-allowed ${
                    n === page ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"
                  }`}
                  onClick={() => {
                    setPage(n);
                    fetchPatients(query, n);
                  }}
                  disabled={loading}
                >
                  {n}
                </button>
              ))}
              {/* Trailing ellipsis if we are skipping pages */}
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
            Weiter
          </button>

          <button
            className="rounded border px-2 py-1 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              const newPage = totalPages;
              setPage(newPage);
              fetchPatients(query, newPage);
            }}
            disabled={page >= totalPages || loading}
          >
            Letzte
          </button>
        </div>
      </div>
    </div>
  );
}
