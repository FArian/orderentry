"use client";

/**
 * useRoles — presentation hook for the role catalog.
 *
 * Mirrors the pattern of useUsers:
 *   fetch → state → expose (roles, loading, error, actions)
 *
 * GET /api/roles is public (no auth required).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRefresh } from "@/lib/refresh";
import type {
  RoleCatalogEntryDto,
  CreateRoleRequestDto,
  UpdateRoleRequestDto,
} from "@/infrastructure/api/dto/RoleDto";

interface UseRolesReturn {
  roles:        RoleCatalogEntryDto[];
  loading:      boolean;
  error:        string | null;
  reload:       () => void;
  createRole:   (data: CreateRoleRequestDto) => Promise<RoleCatalogEntryDto>;
  updateRole:   (id: string, data: UpdateRoleRequestDto) => Promise<RoleCatalogEntryDto>;
  deleteRole:   (id: string) => Promise<void>;
}

export function useRoles(): UseRolesReturn {
  const { refreshCount } = useRefresh();
  const [roles,   setRoles]   = useState<RoleCatalogEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tick,    setTick]    = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/roles", {
        signal: abortRef.current.signal,
        cache:  "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json() as { data: RoleCatalogEntryDto[] };
      setRoles(Array.isArray(json.data) ? json.data : []);
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, tick, refreshCount]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // ── Mutations ───────────────────────────────────────────────────────────────

  async function createRole(data: CreateRoleRequestDto): Promise<RoleCatalogEntryDto> {
    const res = await fetch("/api/roles", {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    reload();
    return json as RoleCatalogEntryDto;
  }

  async function updateRole(id: string, data: UpdateRoleRequestDto): Promise<RoleCatalogEntryDto> {
    const res = await fetch(`/api/roles/${id}`, {
      method:  "PUT",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    reload();
    return json as RoleCatalogEntryDto;
  }

  async function deleteRole(id: string): Promise<void> {
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error ?? `HTTP ${res.status}`);
    }
    reload();
  }

  return { roles, loading, error, reload, createRole, updateRole, deleteRole };
}
