"use client";

/**
 * AdminMergePage — detect and merge duplicate FHIR registry entries.
 *
 * Duplicates share the same GLN. The admin selects which record to keep;
 * all others are merged into it (PractitionerRole refs remapped, duplicates deleted).
 */

import { useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { useTranslation } from "@/lib/i18n";
import { useAdminMerge } from "@/presentation/hooks/useAdminMerge";
import type {
  DuplicateOrgGroup,
  DuplicatePractGroup,
  MergeOrgsRequestDto,
  MergePractsRequestDto,
} from "@/infrastructure/api/controllers/AdminMergeController";

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zt-border bg-zt-bg-card p-5 space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-4 rounded bg-zt-bg-muted animate-pulse" />
      ))}
    </div>
  );
}

// ── OrgDuplicateCard ───────────────────────────────────────────────────────────

function OrgDuplicateCard({
  group,
  mergeOrgs,
  t,
}: {
  group:     DuplicateOrgGroup;
  mergeOrgs: (dto: MergeOrgsRequestDto) => Promise<void>;
  t:         (k: string) => string;
}) {
  const [keepId,   setKeepId]   = useState(group.orgs[0]?.id ?? "");
  const [busy,     setBusy]     = useState(false);
  const [mergeErr, setMergeErr] = useState<string | null>(null);

  const handleMerge = async () => {
    setBusy(true);
    setMergeErr(null);
    try {
      const toDelete = group.orgs.filter((o) => o.id !== keepId);
      for (const del of toDelete) {
        await mergeOrgs({ keepId, deleteId: del.id });
      }
    } catch (e: unknown) {
      setMergeErr(e instanceof Error ? e.message : t("merge.mergeFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-zt-bg-card border border-zt-danger-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-zt-danger-light border-b border-zt-danger-border">
        <span className="text-[12px] font-mono text-zt-text-tertiary">GLN</span>
        <span className="text-[14px] font-semibold text-zt-danger font-mono">{group.gln}</span>
        <span className="ml-auto text-[12px] text-zt-danger opacity-70">
          {group.orgs.length} {t("merge.duplicates")}
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zt-border bg-zt-bg-page">
            <th className="px-5 py-2 text-left text-[11px] text-zt-text-tertiary font-medium w-10">{t("merge.keep")}</th>
            <th className="px-5 py-2 text-left text-[11px] text-zt-text-tertiary font-medium">{t("merge.name")}</th>
            <th className="px-5 py-2 text-left text-[11px] text-zt-text-tertiary font-medium">{t("merge.id")}</th>
          </tr>
        </thead>
        <tbody>
          {group.orgs.map((org) => (
            <tr key={org.id} className="border-b border-zt-border/50 last:border-0 hover:bg-zt-bg-page transition-colors">
              <td className="px-5 py-3 text-center">
                <input
                  type="radio"
                  name={`org-keep-${group.gln}`}
                  value={org.id}
                  checked={keepId === org.id}
                  onChange={() => setKeepId(org.id)}
                  className="accent-zt-primary"
                />
              </td>
              <td className="px-5 py-3 text-[13px] text-zt-text-primary">{org.name || "—"}</td>
              <td className="px-5 py-3 text-[12px] font-mono text-zt-text-tertiary">{org.id}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-5 py-3 border-t border-zt-border flex items-center gap-3">
        <button
          onClick={handleMerge}
          disabled={busy}
          className="px-4 py-1.5 text-[13px] rounded bg-zt-danger text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {busy ? t("merge.merging") : t("merge.mergeBtn")}
        </button>
        <span className="text-[12px] text-zt-text-tertiary">{t("merge.orgHint")}</span>
        {mergeErr && <span className="text-[12px] text-zt-danger ml-auto">{mergeErr}</span>}
      </div>
    </div>
  );
}

// ── PractDuplicateCard ─────────────────────────────────────────────────────────

function PractDuplicateCard({
  group,
  mergePracts,
  t,
}: {
  group:       DuplicatePractGroup;
  mergePracts: (dto: MergePractsRequestDto) => Promise<void>;
  t:           (k: string) => string;
}) {
  const [keepRoleId, setKeepRoleId] = useState(group.practs[0]?.practitionerRoleId ?? "");
  const [busy,       setBusy]       = useState(false);
  const [mergeErr,   setMergeErr]   = useState<string | null>(null);

  const handleMerge = async () => {
    setBusy(true);
    setMergeErr(null);
    try {
      const toDelete = group.practs.filter((p) => p.practitionerRoleId !== keepRoleId);
      for (const del of toDelete) {
        await mergePracts({ keepPractitionerRoleId: keepRoleId, deletePractitionerRoleId: del.practitionerRoleId });
      }
    } catch (e: unknown) {
      setMergeErr(e instanceof Error ? e.message : t("merge.mergeFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-zt-bg-card border border-zt-danger-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-zt-danger-light border-b border-zt-danger-border">
        <span className="text-[12px] font-mono text-zt-text-tertiary">GLN</span>
        <span className="text-[14px] font-semibold text-zt-danger font-mono">{group.gln}</span>
        <span className="ml-auto text-[12px] text-zt-danger opacity-70">
          {group.practs.length} {t("merge.duplicates")}
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zt-border bg-zt-bg-page">
            <th className="px-5 py-2 text-left text-[11px] text-zt-text-tertiary font-medium w-10">{t("merge.keep")}</th>
            <th className="px-5 py-2 text-left text-[11px] text-zt-text-tertiary font-medium">{t("merge.practName")}</th>
            <th className="px-5 py-2 text-left text-[11px] text-zt-text-tertiary font-medium">{t("merge.org")}</th>
            <th className="px-5 py-2 text-left text-[11px] text-zt-text-tertiary font-medium">{t("merge.roleId")}</th>
          </tr>
        </thead>
        <tbody>
          {group.practs.map((p) => (
            <tr key={p.practitionerRoleId} className="border-b border-zt-border/50 last:border-0 hover:bg-zt-bg-page transition-colors">
              <td className="px-5 py-3 text-center">
                <input
                  type="radio"
                  name={`pract-keep-${group.gln}`}
                  value={p.practitionerRoleId}
                  checked={keepRoleId === p.practitionerRoleId}
                  onChange={() => setKeepRoleId(p.practitionerRoleId)}
                  className="accent-zt-primary"
                />
              </td>
              <td className="px-5 py-3 text-[13px] text-zt-text-primary">{p.lastName}, {p.firstName}</td>
              <td className="px-5 py-3 text-[12px] text-zt-text-secondary">{p.organizationName || p.organizationId}</td>
              <td className="px-5 py-3 text-[12px] font-mono text-zt-text-tertiary">{p.practitionerRoleId}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-5 py-3 border-t border-zt-border flex items-center gap-3">
        <button
          onClick={handleMerge}
          disabled={busy}
          className="px-4 py-1.5 text-[13px] rounded bg-zt-danger text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {busy ? t("merge.merging") : t("merge.mergeBtn")}
        </button>
        <span className="text-[12px] text-zt-text-tertiary">{t("merge.practHint")}</span>
        {mergeErr && <span className="text-[12px] text-zt-danger ml-auto">{mergeErr}</span>}
      </div>
    </div>
  );
}

// ── AdminMergePage ─────────────────────────────────────────────────────────────

export default function AdminMergePage() {
  const { t } = useTranslation();
  const { status, loading, error, mergeOrgs, mergePracts } = useAdminMerge();

  const total     = status?.total ?? 0;
  const orgGroups = status?.orgGroups  ?? [];
  const practGroups = status?.practGroups ?? [];
  const allClean  = !loading && !error && total === 0;

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
            <span className="text-zt-text-primary">{t("nav.adminMerge")}</span>
          </nav>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-[20px] font-medium text-zt-text-primary">{t("merge.title")}</h1>
            <p className="text-[13px] text-zt-text-tertiary mt-0.5">{t("merge.subtitle")}</p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-xl border border-zt-danger-border bg-zt-danger-light px-5 py-4 text-[13px] text-zt-danger">
              {error}
            </div>
          )}

          {/* All clean */}
          {allClean && (
            <div className="rounded-xl border border-zt-success-border bg-zt-success-light px-5 py-6 text-center space-y-2">
              <div className="text-[28px]">✓</div>
              <p className="text-[14px] font-medium text-zt-success">{t("merge.allClean")}</p>
              <p className="text-[13px] text-zt-text-tertiary">{t("merge.allCleanDesc")}</p>
            </div>
          )}

          {/* Duplicate groups */}
          {!loading && !error && total > 0 && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="rounded-lg border border-zt-danger-border bg-zt-danger-light px-4 py-3 text-[13px] text-zt-danger">
                ⚠ {t("merge.summary").replace("{n}", String(total))}
              </div>

              {/* Orgs section */}
              {orgGroups.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-[14px] font-medium text-zt-text-primary">{t("merge.orgsSection")}</h2>
                  {orgGroups.map((group) => (
                    <OrgDuplicateCard key={group.gln} group={group} mergeOrgs={mergeOrgs} t={t} />
                  ))}
                </div>
              )}

              {/* Practitioners section */}
              {practGroups.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-[14px] font-medium text-zt-text-primary">{t("merge.practsSection")}</h2>
                  {practGroups.map((group) => (
                    <PractDuplicateCard key={group.gln} group={group} mergePracts={mergePracts} t={t} />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
