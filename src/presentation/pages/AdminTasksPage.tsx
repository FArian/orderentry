"use client";

/**
 * AdminTasksPage — shows all FHIR registry entries that require admin attention.
 *
 * Currently detects:
 *   - Organizations without a GLN number
 *   - Practitioners without a GLN number
 *
 * Admin can click "Edit" to jump directly to the relevant record.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { useTranslation } from "@/lib/i18n";
import type { FhirOrganizationDto, FhirPractitionerDto } from "@/infrastructure/api/dto/FhirRegistryDto";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TasksData {
  total:                   number;
  orgsWithoutGln:          FhirOrganizationDto[];
  practitionersWithoutGln: FhirPractitionerDto[];
}

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

// ── Section ────────────────────────────────────────────────────────────────────

function TaskSection({
  title,
  hint,
  count,
  editHref,
  editLabel,
  rows,
  t,
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
        <Link
          href={editHref}
          className="text-[12px] px-3 py-1 rounded border border-zt-warning-border text-zt-warning-text hover:bg-zt-warning-bg transition-colors"
        >
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

// ── AdminTasksPage ─────────────────────────────────────────────────────────────

export default function AdminTasksPage() {
  const { t } = useTranslation();
  const [data,    setData]    = useState<TasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/tasks", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: TasksData & { error?: string }) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  const orgRows = (data?.orgsWithoutGln ?? []).map((o) => ({
    id:    o.id,
    label: o.name || "—",
    sub:   o.id,
  }));

  const practRows = (data?.practitionersWithoutGln ?? []).map((p) => ({
    id:    p.practitionerRoleId,
    label: `${p.lastName}, ${p.firstName}`,
    sub:   p.practitionerRoleId,
  }));

  const allDone = !loading && !error && data?.total === 0;

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

          {/* Content */}
          {loading && (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-zt-danger-border bg-zt-danger-light px-5 py-4 text-[13px] text-zt-danger">
              {error}
            </div>
          )}

          {allDone && (
            <div className="rounded-xl border border-zt-success-border bg-zt-success-light px-5 py-6 text-center space-y-2">
              <div className="text-[28px]">✓</div>
              <p className="text-[14px] font-medium text-zt-success">{t("tasks.allDone")}</p>
              <p className="text-[13px] text-zt-text-tertiary">{t("tasks.allDoneDesc")}</p>
            </div>
          )}

          {!loading && !error && data && data.total > 0 && (
            <div className="space-y-5">
              {/* Summary banner */}
              <div className="rounded-lg border border-zt-warning-border bg-zt-warning-bg px-4 py-3 text-[13px] text-zt-warning-text">
                ⚠ {t("tasks.summary").replace("{n}", String(data.total))}
              </div>

              <TaskSection
                title={t("tasks.orgsTitle")}
                hint={t("tasks.orgsHint")}
                count={orgRows.length}
                editHref="/admin/organizations"
                editLabel={t("tasks.goToOrgs")}
                rows={orgRows}
                t={t}
              />

              <TaskSection
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
      </div>
    </div>
  );
}
