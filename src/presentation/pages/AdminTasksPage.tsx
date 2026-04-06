"use client";

/**
 * AdminTasksPage — shows all tasks that require admin attention.
 *
 * Section 1 — FHIR Registry tasks (missing GLN):
 *   - Organizations without GLN
 *   - Practitioners without GLN
 *
 * Section 2 — Pool Alert tasks (ORDER_NUMBER_POOL_ALERT):
 *   - Per-serviceType pool threshold alerts
 *   - Resolve button marks the task as RESOLVED
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppSidebar }       from "@/components/AppSidebar";
import { BackButton }       from "@/components/BackButton";
import { useTranslation }   from "@/lib/i18n";
import type { FhirOrganizationDto, FhirPractitionerDto } from "@/infrastructure/api/dto/FhirRegistryDto";
import type { AdminTask }   from "@/domain/entities/AdminTask";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FhirTasksData {
  total:                   number;
  orgsWithoutGln:          FhirOrganizationDto[];
  practitionersWithoutGln: FhirPractitionerDto[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "border-zt-danger-border  bg-zt-danger-light  text-zt-danger",
  WARNING:  "border-zt-warning-border bg-zt-warning-bg    text-zt-warning-text",
  INFO:     "border-zt-info-border    bg-zt-info-light    text-zt-info",
};

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-zt-danger  text-white",
  WARNING:  "bg-zt-warning-text text-white",
  INFO:     "bg-zt-info    text-white",
};

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zt-border bg-zt-bg-card p-4 space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-4 rounded bg-zt-bg-muted animate-pulse" />
      ))}
    </div>
  );
}

// ── FHIR Task Section ──────────────────────────────────────────────────────────

function FhirTaskSection({
  title, hint, count, editHref, editLabel,
  rows, t,
}: {
  title:     string;
  hint:      string;
  count:     number;
  editHref:  string;
  editLabel: string;
  rows:      { id: string; label: string; sub: string }[];
  t:         (k: string) => string;
}) {
  if (count === 0) return null;
  return (
    <div className="bg-zt-bg-card border border-zt-warning-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-zt-warning-bg border-b border-zt-warning-border">
        <div>
          <span className="text-[14px] font-medium text-zt-warning-text">{title}</span>
          <span className="ml-2 text-[12px] text-zt-warning-text opacity-70">({count})</span>
        </div>
        <Link href={editHref} className="text-[12px] px-3 py-1 rounded border border-zt-warning-border text-zt-warning-text hover:bg-zt-warning-bg transition-colors">
          {editLabel} →
        </Link>
      </div>
      <p className="px-5 py-2.5 text-[12px] text-zt-text-tertiary border-b border-zt-border">{hint}</p>
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-zt-border/50 last:border-0 hover:bg-zt-bg-page transition-colors">
              <td className="px-5 py-3 text-[13px] font-medium text-zt-text-primary">{row.label}</td>
              <td className="px-5 py-3 text-[12px] font-mono text-zt-text-tertiary">{row.id}</td>
              <td className="px-5 py-3">
                <span className="text-[11px] px-2 py-0.5 rounded border border-zt-warning-border bg-zt-warning-bg text-zt-warning-text">
                  {t("tasks.missingGln")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pool Alert Task Row ────────────────────────────────────────────────────────

function PoolAlertRow({
  task, onResolve, resolving,
}: {
  task:      AdminTask;
  onResolve: (id: string) => void;
  resolving: boolean;
}) {
  const style  = SEVERITY_STYLES[task.severity] ?? SEVERITY_STYLES["INFO"];
  const badge  = SEVERITY_BADGE[task.severity]  ?? SEVERITY_BADGE["INFO"];

  return (
    <div className={`rounded-xl border px-5 py-4 flex items-start justify-between gap-4 ${style}`}>
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
          href="/admin/number-pool"
          className="text-[12px] mt-1 inline-block underline opacity-70 hover:opacity-100"
        >
          Pool auffüllen →
        </Link>
      </div>
      <button
        onClick={() => onResolve(task.id)}
        disabled={resolving}
        className="shrink-0 px-3 py-1.5 text-[12px] rounded border border-current opacity-70 hover:opacity-100 disabled:opacity-40 transition-opacity"
      >
        {resolving ? "…" : "Erledigt"}
      </button>
    </div>
  );
}

// ── AdminTasksPage ─────────────────────────────────────────────────────────────

export default function AdminTasksPage() {
  const { t } = useTranslation();

  // FHIR tasks
  const [fhirData,    setFhirData]    = useState<FhirTasksData | null>(null);
  const [fhirLoading, setFhirLoading] = useState(true);
  const [fhirError,   setFhirError]   = useState<string | null>(null);

  // Pool alert tasks
  const [poolTasks,    setPoolTasks]    = useState<AdminTask[]>([]);
  const [poolLoading,  setPoolLoading]  = useState(true);
  const [poolError,    setPoolError]    = useState<string | null>(null);
  const [resolving,    setResolving]    = useState<string | null>(null);

  const loadFhirTasks = useCallback(() => {
    setFhirLoading(true);
    fetch("/api/admin/tasks", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: FhirTasksData & { error?: string }) => {
        if (d.error) setFhirError(d.error);
        else setFhirData(d);
      })
      .catch((e: unknown) => setFhirError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setFhirLoading(false));
  }, []);

  const loadPoolTasks = useCallback(() => {
    setPoolLoading(true);
    fetch("/api/v1/admin/pool-tasks", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { data?: AdminTask[]; error?: string }) => {
        if (d.error) setPoolError(d.error);
        else setPoolTasks(d.data ?? []);
      })
      .catch((e: unknown) => setPoolError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setPoolLoading(false));
  }, []);

  useEffect(() => {
    loadFhirTasks();
    loadPoolTasks();
  }, [loadFhirTasks, loadPoolTasks]);

  const handleResolve = useCallback(async (id: string) => {
    setResolving(id);
    try {
      const res = await fetch(`/api/v1/admin/pool-tasks/${id}/resolve`, { method: "POST" });
      if (res.ok) {
        setPoolTasks((prev) => prev.filter((t) => t.id !== id));
      }
    } finally {
      setResolving(null);
    }
  }, []);

  const orgRows = (fhirData?.orgsWithoutGln ?? []).map((o) => ({
    id: o.id, label: o.name || "—", sub: o.id,
  }));
  const practRows = (fhirData?.practitionersWithoutGln ?? []).map((p) => ({
    id: p.practitionerRoleId, label: `${p.lastName}, ${p.firstName}`, sub: p.practitionerRoleId,
  }));

  const isLoading = fhirLoading || poolLoading;
  const totalCount = (fhirData?.total ?? 0) + poolTasks.length;
  const allDone = !isLoading && !fhirError && !poolError && totalCount === 0;

  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />

      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[960px] mx-auto">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary mb-4">
            <BackButton />
            <span>|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("nav.adminTasks")}</span>
          </nav>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-[20px] font-medium text-zt-text-primary">{t("tasks.title")}</h1>
            <p className="text-[13px] text-zt-text-tertiary mt-0.5">{t("tasks.subtitle")}</p>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* All done */}
          {allDone && (
            <div className="rounded-xl border border-zt-success-border bg-zt-success-light px-5 py-6 text-center space-y-2">
              <div className="text-[28px]">✓</div>
              <p className="text-[14px] font-medium text-zt-success">{t("tasks.allDone")}</p>
              <p className="text-[13px] text-zt-text-tertiary">{t("tasks.allDoneDesc")}</p>
            </div>
          )}

          {!isLoading && totalCount > 0 && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="rounded-lg border border-zt-warning-border bg-zt-warning-bg px-4 py-3 text-[13px] text-zt-warning-text">
                ⚠ {t("tasks.summary").replace("{n}", String(totalCount))}
              </div>

              {/* ── Pool Alert Tasks ─────────────────────────────────────────── */}
              {poolTasks.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-[15px] font-medium text-zt-text-primary flex items-center gap-2">
                    <span>🔴</span>
                    <span>Nummernpool-Alarme</span>
                    <span className="text-[12px] font-normal text-zt-text-tertiary">
                      ({poolTasks.length})
                    </span>
                  </h2>
                  {poolTasks.map((task) => (
                    <PoolAlertRow
                      key={task.id}
                      task={task}
                      onResolve={handleResolve}
                      resolving={resolving === task.id}
                    />
                  ))}
                </div>
              )}

              {poolError && (
                <div className="rounded-xl border border-zt-danger-border bg-zt-danger-light px-5 py-3 text-[13px] text-zt-danger">
                  Pool-Alarme: {poolError}
                </div>
              )}

              {/* ── FHIR Registry Tasks ──────────────────────────────────────── */}
              {fhirError && (
                <div className="rounded-xl border border-zt-danger-border bg-zt-danger-light px-5 py-4 text-[13px] text-zt-danger">
                  {fhirError}
                </div>
              )}

              {fhirData && fhirData.total > 0 && (
                <div className="space-y-4">
                  <h2 className="text-[15px] font-medium text-zt-text-primary flex items-center gap-2">
                    <span>⚠️</span>
                    <span>FHIR-Registrierung</span>
                    <span className="text-[12px] font-normal text-zt-text-tertiary">
                      ({fhirData.total})
                    </span>
                  </h2>
                  <FhirTaskSection
                    title={t("tasks.orgsTitle")}
                    hint={t("tasks.orgsHint")}
                    count={orgRows.length}
                    editHref="/admin/organizations"
                    editLabel={t("tasks.goToOrgs")}
                    rows={orgRows}
                    t={t}
                  />
                  <FhirTaskSection
                    title={t("tasks.practsTitle")}
                    hint={t("tasks.practsHint")}
                    count={practRows.length}
                    editHref="/admin/fhir?tab=practitioners"
                    editLabel={t("tasks.goToFhir")}
                    rows={practRows}
                    t={t}
                  />
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
