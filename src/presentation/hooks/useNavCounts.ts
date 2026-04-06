"use client";

/**
 * useNavCounts — fetches sidebar badge counts for Patients, Orders, Results.
 *
 * All three requests run in parallel. Returns null while loading or on error
 * (NavItem hides the badge when undefined/null).
 * Counts are org-scoped: the API routes apply the session org filter automatically.
 */

import { useEffect, useState } from "react";
import { useRefresh } from "@/lib/refresh";

export interface NavCounts {
  patients:   number | null;
  orders:     number | null;
  results:    number | null;
  users:      number | null;
  fhirOrgs:   number | null;
  roles:      number | null;
  tasks:      number | null;
  mergeCount: number | null;
}

async function fetchTotal(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { total?: number };
    return typeof data.total === "number" ? data.total : null;
  } catch {
    return null;
  }
}

export function useNavCounts(authenticated: boolean): NavCounts {
  const { refreshCount } = useRefresh();
  const [counts, setCounts] = useState<NavCounts>({
    patients:   null,
    orders:     null,
    results:    null,
    users:      null,
    fhirOrgs:   null,
    roles:      null,
    tasks:      null,
    mergeCount: null,
  });

  useEffect(() => {
    if (!authenticated) return;

    Promise.all([
      fetchTotal("/api/patients?pageSize=1"),
      fetchTotal("/api/service-requests"),
      fetchTotal("/api/diagnostic-reports?pageSize=1"),
      fetchTotal("/api/users?pageSize=1"),
      fetchTotal("/api/fhir/organizations"),
      fetchTotal("/api/roles"),
      fetchTotal("/api/admin/tasks"),
      fetchTotal("/api/admin/merge"),
      fetchTotal("/api/v1/admin/pool-tasks"),
    ]).then(([patients, orders, results, users, fhirOrgs, roles, fhirTasks, mergeCount, poolTasks]) => {
      // Combine FHIR registry tasks + pool alert tasks into one badge
      const tasks = (fhirTasks ?? 0) + (poolTasks ?? 0) || null;
      setCounts({ patients, orders, results, users, fhirOrgs, roles, tasks, mergeCount });
    });
  }, [authenticated, refreshCount]);

  return counts;
}
