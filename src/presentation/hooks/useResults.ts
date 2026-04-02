"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Result } from "@/domain/entities/Result";
import { ServiceFactory } from "@/infrastructure/ServiceFactory";
import type { ResultSearchQuery } from "@/application/interfaces/repositories/IResultRepository";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResultsState {
  results: Result[];
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
}

export interface UseResultsReturn extends ResultsState {
  /** Replace the current filters and reset to page 1. */
  search: (query: Omit<ResultSearchQuery, "page" | "pageSize">) => void;
  setPage: (page: number) => void;
  reload: () => void;
}

// ── Module-level singleton (DI via ServiceFactory) ────────────────────────────
// Created once per module; the service is stateless so sharing it is safe.

const _service = ServiceFactory.resultService();

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Presentation hook: loads DiagnosticReport data through the CA stack.
 *
 *   useResults → ServiceFactory.resultService()
 *             → ResultService → GetResults / SearchResults use cases
 *             → FhirResultRepository → /api/diagnostic-reports
 */
export function useResults(
  initial: ResultSearchQuery = {},
): UseResultsReturn {
  const [query, setQuery] = useState<ResultSearchQuery>({
    page: 1,
    pageSize: 20,
    ...initial,
  });

  const [state, setState] = useState<ResultsState>({
    results: [],
    total: 0,
    loading: true,
    error: null,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  });

  // Track mounted state to prevent state updates after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async (q: ResultSearchQuery) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const paged = await _service.search(q);
      if (!mountedRef.current) return;
      setState({
        results: paged.data,
        total: paged.total,
        loading: false,
        error: null,
        page: paged.page,
        pageSize: paged.pageSize,
      });
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  useEffect(() => {
    load(query);
  }, [load, query]);

  // ── Public API ────────────────────────────────────────────────────────────

  /** Apply new filters and reset to page 1. */
  const search = useCallback(
    (newFilters: Omit<ResultSearchQuery, "page" | "pageSize">) => {
      setQuery((prev) => ({ ...prev, ...newFilters, page: 1 }));
    },
    [],
  );

  const setPage = useCallback((page: number) => {
    setQuery((prev) => ({ ...prev, page }));
  }, []);

  const reload = useCallback(() => {
    load(query);
  }, [load, query]);

  return { ...state, search, setPage, reload };
}
