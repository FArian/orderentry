"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ReservedOrderNumberDto,
  PoolThresholdDto,
  PoolStatsDto,
} from "@/infrastructure/api/dto/NumberPoolDto";

export interface UseNumberPoolResult {
  entries:          ReservedOrderNumberDto[];
  stats:            Record<string, PoolStatsDto>;
  thresholds:       PoolThresholdDto | null;
  loading:          boolean;
  error:            string | null;
  addNumbers:       (numbers: string[], serviceType: string, orgFhirId?: string | null) => Promise<{ added: number; skipped: number }>;
  deleteEntry:      (id: string) => Promise<void>;
  updateThresholds: (data: PoolThresholdDto) => Promise<void>;
}

function computeStats(entries: ReservedOrderNumberDto[]): Record<string, PoolStatsDto> {
  const acc: Record<string, PoolStatsDto> = {};
  for (const e of entries) {
    const st = e.serviceType;
    if (!acc[st]) acc[st] = { total: 0, available: 0, used: 0 };
    acc[st].total++;
    if (e.status === "available") acc[st].available++;
    else acc[st].used++;
  }
  return acc;
}

export function useNumberPool(): UseNumberPoolResult {
  const [entries,    setEntries]    = useState<ReservedOrderNumberDto[]>([]);
  const [stats,      setStats]      = useState<Record<string, PoolStatsDto>>({});
  const [thresholds, setThresholds] = useState<PoolThresholdDto | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [poolRes, threshRes] = await Promise.all([
        fetch("/api/v1/admin/number-pool"),
        fetch("/api/v1/admin/number-pool/thresholds"),
      ]);
      if (!poolRes.ok)   throw new Error(`Pool HTTP ${poolRes.status}`);
      if (!threshRes.ok) throw new Error(`Thresholds HTTP ${threshRes.status}`);

      const poolData   = await poolRes.json()   as { data: ReservedOrderNumberDto[] };
      const threshData = await threshRes.json() as PoolThresholdDto;

      setEntries(poolData.data);
      setStats(computeStats(poolData.data));
      setThresholds(threshData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden des Number Pool");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addNumbers = useCallback(async (numbers: string[], serviceType: string, orgFhirId?: string | null) => {
    const body: Record<string, unknown> = { numbers, serviceType };
    if (orgFhirId) body.orgFhirId = orgFhirId;
    const res = await fetch("/api/v1/admin/number-pool", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string; error?: string };
      throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
    }
    const result = await res.json() as { added: number; rejected: string[] };
    await load();
    return { added: result.added, skipped: result.rejected?.length ?? 0 };
  }, [load]);

  const deleteEntry = useCallback(async (id: string) => {
    const res = await fetch(`/api/v1/admin/number-pool/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string; error?: string };
      throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
    }
    await load();
  }, [load]);

  const updateThresholds = useCallback(async (data: PoolThresholdDto) => {
    const res = await fetch("/api/v1/admin/number-pool/thresholds", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string; error?: string };
      throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
    }
    setThresholds(data);
  }, []);

  return { entries, stats, thresholds, loading, error, addNumbers, deleteEntry, updateThresholds };
}
