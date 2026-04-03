"use client";

import { useState, useEffect, useCallback } from "react";
import { useRefresh } from "@/lib/refresh";
import type {
  AdminMergeStatusDto,
  MergeOrgsRequestDto,
  MergePractsRequestDto,
} from "@/infrastructure/api/controllers/AdminMergeController";

interface UseAdminMergeResult {
  status:       AdminMergeStatusDto | null;
  loading:      boolean;
  error:        string | null;
  reload:       () => void;
  mergeOrgs:    (dto: MergeOrgsRequestDto) => Promise<void>;
  mergePracts:  (dto: MergePractsRequestDto) => Promise<void>;
}

export function useAdminMerge(): UseAdminMergeResult {
  const { refreshCount } = useRefresh();
  const [status,  setStatus]  = useState<AdminMergeStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [rev,     setRev]     = useState(0);

  const reload = useCallback(() => setRev((r) => r + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fetch("/api/admin/merge", { signal: ctrl.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((data: AdminMergeStatusDto & { error?: string }) => {
        if (data.error) setError(data.error);
        else setStatus(data);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Load failed");
        }
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [rev, refreshCount]);

  const mergeOrgs = useCallback(async (dto: MergeOrgsRequestDto): Promise<void> => {
    const res = await fetch("/api/admin/merge/organizations", {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify(dto),
    });
    const data = (await res.json()) as { merged?: boolean; error?: string };
    if (!res.ok || !data.merged) throw new Error(data.error ?? `HTTP ${res.status}`);
    reload();
  }, [reload]);

  const mergePracts = useCallback(async (dto: MergePractsRequestDto): Promise<void> => {
    const res = await fetch("/api/admin/merge/practitioners", {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify(dto),
    });
    const data = (await res.json()) as { merged?: boolean; error?: string };
    if (!res.ok || !data.merged) throw new Error(data.error ?? `HTTP ${res.status}`);
    reload();
  }, [reload]);

  return { status, loading, error, reload, mergeOrgs, mergePracts };
}
