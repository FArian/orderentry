"use client";

/**
 * useMyPermissions — fetches the current user's role and permissions.
 *
 * Calls GET /api/v1/me/permissions (server returns { role, permissions[] }).
 * The hook is used by the Profile page and any component that needs to
 * conditionally render based on the current user's capabilities.
 */

import { useEffect, useState } from "react";

export interface MyPermissionsData {
  role:        string;
  permissions: string[];
}

export interface UseMyPermissionsResult {
  data:    MyPermissionsData | null;
  loading: boolean;
  error:   string | null;
}

export function useMyPermissions(): UseMyPermissionsResult {
  const [data,    setData]    = useState<MyPermissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/v1/me/permissions", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MyPermissionsData>;
      })
      .then((json) => {
        if (!cancelled) { setData(json); setLoading(false); }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Fehler beim Laden");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
