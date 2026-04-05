"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrgRuleDto } from "@/infrastructure/api/dto/OrgRuleDto";

export interface UseOrgRulesResult {
  rules:        OrgRuleDto[];
  loading:      boolean;
  error:        string | null;
  createRule:   (data: Partial<OrgRuleDto>) => Promise<void>;
  updateRule:   (id: string, data: Partial<OrgRuleDto>) => Promise<void>;
  deleteRule:   (id: string) => Promise<void>;
}

export function useOrgRules(): UseOrgRulesResult {
  const [rules,   setRules]   = useState<OrgRuleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/org-rules");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { data: OrgRuleDto[] } | OrgRuleDto[];
      setRules(Array.isArray(body) ? body : body.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden der Org-Regeln");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function extractError(body: Record<string, unknown>, status: number): string {
    const msg = (body.detail ?? body.error ?? body.message) as string | undefined;
    if (msg) return msg;
    if (status === 409) return "Diese Organisation hat bereits eine Regel.";
    if (status === 400) return "Pflichtfelder fehlen (FHIR-ID und Name sind erforderlich).";
    if (status === 404) return "Eintrag nicht gefunden.";
    return `HTTP ${status}`;
  }

  const createRule = useCallback(async (data: Partial<OrgRuleDto>) => {
    const res = await fetch("/api/v1/admin/org-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(extractError(body, res.status));
    }
    await load();
  }, [load]);

  const updateRule = useCallback(async (id: string, data: Partial<OrgRuleDto>) => {
    const res = await fetch(`/api/v1/admin/org-rules/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(extractError(body, res.status));
    }
    await load();
  }, [load]);

  const deleteRule = useCallback(async (id: string) => {
    const res = await fetch(`/api/v1/admin/org-rules/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(extractError(body, res.status));
    }
    await load();
  }, [load]);

  return { rules, loading, error, createRule, updateRule, deleteRule };
}
