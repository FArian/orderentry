"use client";

/**
 * useUsers — presentation hook for the admin users management UI.
 *
 * Mirrors the pattern of useOrders / useResults:
 *   fetch → state → expose (users, loading, error, actions)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  UserResponseDto,
  CreateUserRequestDto,
  UpdateUserRequestDto,
  ListUsersQueryDto,
} from "@/infrastructure/api/dto/UserDto";

interface UseUsersOptions {
  pageSize?: number;
}

interface UseUsersReturn {
  users: UserResponseDto[];
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  reload: () => void;
  createUser:  (data: CreateUserRequestDto) => Promise<UserResponseDto>;
  updateUser:  (id: string, data: UpdateUserRequestDto) => Promise<UserResponseDto>;
  deleteUser:  (id: string) => Promise<void>;
  syncToFhir:  (id: string) => Promise<{ synced: boolean; error?: string }>;
}

export function useUsers(
  filters: Pick<ListUsersQueryDto, "q" | "role" | "status"> = {},
  options: UseUsersOptions = {},
): UseUsersReturn {
  const { pageSize = 20 } = options;

  const [users,   setUsers]   = useState<UserResponseDto[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [page,    setPage]    = useState(1);
  const [tick,    setTick]    = useState(0);   // increment to re-fetch

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (currentPage: number) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const sp = new URLSearchParams();
    if (filters.q)      sp.set("q",      filters.q);
    if (filters.role)   sp.set("role",   filters.role);
    if (filters.status) sp.set("status", filters.status);
    sp.set("page",     String(currentPage));
    sp.set("pageSize", String(pageSize));

    try {
      const res = await fetch(`/api/users?${sp.toString()}`, {
        signal: abortRef.current.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json() as { data: UserResponseDto[]; total: number };
      setUsers(Array.isArray(json.data) ? json.data : []);
      setTotal(json.total ?? 0);
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filters.q, filters.role, filters.status, pageSize]);

  useEffect(() => { load(page); }, [load, page, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // ── Mutations ───────────────────────────────────────────────────────────────

  async function createUser(data: CreateUserRequestDto): Promise<UserResponseDto> {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    reload();
    return json as UserResponseDto;
  }

  async function updateUser(id: string, data: UpdateUserRequestDto): Promise<UserResponseDto> {
    const res = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    reload();
    return json as UserResponseDto;
  }

  async function deleteUser(id: string): Promise<void> {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error ?? `HTTP ${res.status}`);
    }
    reload();
  }

  async function syncToFhir(id: string): Promise<{ synced: boolean; error?: string }> {
    const res = await fetch(`/api/users/${id}/sync`, { method: "POST" });
    const json = await res.json() as { synced: boolean; error?: string };
    reload();
    return json;
  }

  return {
    users, total, loading, error,
    page, pageSize,
    setPage,
    reload,
    createUser,
    updateUser,
    deleteUser,
    syncToFhir,
  };
}
