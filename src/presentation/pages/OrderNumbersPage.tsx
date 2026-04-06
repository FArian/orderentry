"use client";

/**
 * OrderNumbersPage — unified admin page for order number management.
 *
 * Tab 1 — Org Rules:     per-org HL7 + prefix config (OrgRulesPage mode="tab")
 * Tab 2 — Number Pool:   pool entries, stats, thresholds (NumberPoolPage mode="tab")
 * Tab 3 — Monitoring:    pool alert tasks per serviceType with Resolve action
 */

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback }         from "react";
import Link                                         from "next/link";
import { AppSidebar }    from "@/components/AppSidebar";
import { BackButton }    from "@/components/BackButton";
import { useTranslation } from "@/lib/i18n";
import OrgRulesPage      from "@/presentation/pages/OrgRulesPage";
import NumberPoolPage    from "@/presentation/pages/NumberPoolPage";
import type { AdminTask } from "@/domain/entities/AdminTask";

// ── Tab definition ─────────────────────────────────────────────────────────────

type TabId = "org-rules" | "number-pool" | "monitoring";

const TABS: { id: TabId; labelKey: string }[] = [
  { id: "org-rules",    labelKey: "orderNumbers.tabOrgRules"   },
  { id: "number-pool",  labelKey: "orderNumbers.tabNumberPool" },
  { id: "monitoring",   labelKey: "orderNumbers.tabMonitoring" },
];

// ── Severity styles ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "border-zt-danger-border  bg-zt-danger-light  text-zt-danger",
  WARNING:  "border-zt-warning-border bg-zt-warning-bg    text-zt-warning-text",
  INFO:     "border-zt-info-border    bg-zt-info-light    text-zt-info",
};
const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-zt-danger       text-white",
  WARNING:  "bg-zt-warning-text text-white",
  INFO:     "bg-zt-info         text-white",
};

// ── MonitoringTab ──────────────────────────────────────────────────────────────

function MonitoringTab({ t }: { t: (k: string) => string }) {
  const [tasks,     setTasks]     = useState<AdminTask[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const loadTasks = useCallback(() => {
    setLoading(true);
    fetch("/api/v1/admin/pool-tasks", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { data?: AdminTask[]; error?: string }) => {
        if (d.error) setError(d.error);
        else setTasks(d.data ?? []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleResolve = useCallback(async (id: string) => {
    setResolving(id);
    try {
      const res = await fetch(`/api/v1/admin/pool-tasks/${id}/resolve`, { method: "POST" });
      if (res.ok) setTasks((prev) => prev.filter((task) => task.id !== id));
    } finally {
      setResolving(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="h-16 rounded-xl bg-zt-bg-card border border-zt-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-zt-danger-border bg-zt-danger-light px-5 py-4 text-[13px] text-zt-danger mt-4">
        {error}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-zt-success-border bg-zt-success-light px-5 py-8 text-center mt-4">
        <div className="text-[24px] mb-2">✓</div>
        <p className="text-[14px] font-medium text-zt-success">{t("orderNumbers.noAlerts")}</p>
        <p className="text-[12px] text-zt-text-tertiary mt-1">{t("orderNumbers.noAlertsDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-4">
      <div className="rounded-lg border border-zt-warning-border bg-zt-warning-bg px-4 py-3 text-[13px] text-zt-warning-text">
        ⚠ {t("orderNumbers.alertSummary").replace("{n}", String(tasks.length))}
      </div>

      {tasks.map((task) => {
        const style = SEVERITY_STYLES[task.severity] ?? SEVERITY_STYLES["INFO"];
        const badge = SEVERITY_BADGE[task.severity]  ?? SEVERITY_BADGE["INFO"];
        return (
          <div
            key={task.id}
            className={`rounded-xl border px-5 py-4 flex items-start justify-between gap-4 ${style}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge}`}>
                  {task.severity}
                </span>
                {task.serviceType && (
                  <span className="text-[11px] font-mono bg-zt-bg-muted text-zt-text-secondary px-2 py-0.5 rounded">
                    {task.serviceType}
                  </span>
                )}
                <span className="text-[11px] text-zt-text-tertiary">
                  {new Date(task.createdAt).toLocaleDateString("de-CH")}
                </span>
              </div>
              <p className="text-[13px] font-medium">{task.message}</p>
              <Link
                href="/admin/order-numbers?tab=number-pool"
                className="text-[12px] mt-1 inline-block underline opacity-70 hover:opacity-100"
              >
                {t("orderNumbers.goToPool")} →
              </Link>
            </div>
            <button
              onClick={() => handleResolve(task.id)}
              disabled={resolving === task.id}
              className="shrink-0 px-3 py-1.5 text-[12px] rounded border border-current opacity-70 hover:opacity-100 disabled:opacity-40 transition-opacity"
            >
              {resolving === task.id ? "…" : t("orderNumbers.resolve")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── OrderNumbersPage ───────────────────────────────────────────────────────────

export default function OrderNumbersPage() {
  const { t }       = useTranslation();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const pathname     = usePathname();

  const rawTab  = searchParams.get("tab") ?? "org-rules";
  const activeTab: TabId = (["org-rules", "number-pool", "monitoring"] as const).includes(rawTab as TabId)
    ? (rawTab as TabId)
    : "org-rules";

  function handleTabClick(id: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />

      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[1200px] mx-auto">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary mb-4">
            <BackButton />
            <span>|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("nav.adminOrderNumbers")}</span>
          </nav>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-[20px] font-medium text-zt-text-primary">{t("orderNumbers.title")}</h1>
            <p className="text-[13px] text-zt-text-tertiary mt-0.5">{t("orderNumbers.subtitle")}</p>
          </div>

          {/* Tab nav */}
          <div className="flex items-center gap-1 border-b border-zt-border mb-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? "border-zt-primary text-zt-primary"
                    : "border-transparent text-zt-text-secondary hover:text-zt-text-primary hover:border-zt-border"
                }`}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "org-rules"   && <OrgRulesPage   mode="tab" />}
          {activeTab === "number-pool" && <NumberPoolPage  mode="tab" />}
          {activeTab === "monitoring"  && <MonitoringTab   t={t}      />}

        </div>
      </div>
    </div>
  );
}
