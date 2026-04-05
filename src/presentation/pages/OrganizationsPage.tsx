"use client";

/**
 * OrganizationsPage — Admin page for managing FHIR Organizations.
 *
 * Provides: list, create (modal), delete with confirmation.
 * Organizations created here are stored in FHIR and can then be
 * assigned to users in /admin/users.
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { useFhirOrganizations } from "@/presentation/hooks/useFhirOrganizations";
import { useTranslation } from "@/lib/i18n";
import type { CreateOrganizationRequestDto, FhirOrganizationDto } from "@/infrastructure/api/dto/FhirRegistryDto";
import { validateGln, sanitizeGln } from "@/shared/utils/swissValidators";
import { useDebugMode } from "@/presentation/hooks/useDebugMode";
import { DebugProvider, useDebugContext, tracedFetch } from "@/presentation/context/DebugContext";
import { DebugPanel } from "@/presentation/components/DebugPanel";

// ── Styles ─────────────────────────────────────────────────────────────────────

const fieldCls = "w-full px-3 py-2 text-[13px] border border-zt-border rounded-lg bg-zt-bg-page text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary focus:ring-2 focus:ring-zt-primary/10";
const labelCls = "block text-[12px] font-medium text-zt-text-secondary mb-1";

// ── Flash ──────────────────────────────────────────────────────────────────────

type FlashMsg = { text: string; ok: boolean } | null;

function Flash({ msg }: { msg: FlashMsg }) {
  if (!msg) return null;
  return (
    <div className={`rounded border px-3 py-1.5 text-[12px] ${
      msg.ok
        ? "border-zt-success-border bg-zt-success-light text-zt-success"
        : "border-zt-danger-border bg-zt-danger-light text-zt-danger"
    }`}>
      {msg.text}
    </div>
  );
}

// ── Create modal ───────────────────────────────────────────────────────────────

interface CreateModalProps {
  initial?:      FhirOrganizationDto;
  allOrgs:       FhirOrganizationDto[];
  onSave:        (dto: CreateOrganizationRequestDto) => Promise<void>;
  onClose:       () => void;
  saving:        boolean;
  error:         string | null;
  t:             (k: string) => string;
}

function CreateModal({ initial, allOrgs, onSave, onClose, saving, error, t }: CreateModalProps) {
  const [name,     setName]     = useState(initial?.name     ?? "");
  const [gln,      setGln]      = useState(initial?.gln      ?? "");
  const [parentId, setParentId] = useState(initial?.parentId ?? "");
  const [glnError, setGlnError] = useState<string | null>(null);

  // Exclude self from parent options to prevent self-reference
  const parentOptions = allOrgs.filter((o) => o.id !== initial?.id);

  function handleGlnChange(raw: string) {
    const sanitized = sanitizeGln(raw);
    setGln(sanitized);
    if (sanitized.length === 13) {
      const v = validateGln(sanitized);
      setGlnError(v.error ?? null);
    } else {
      setGlnError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateGln(gln);
    if (!v.valid) { setGlnError(v.error ?? "GLN ungültig"); return; }
    await onSave({ name: name.trim(), gln: gln.trim(), ...(parentId ? { parentId } : {}) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-zt-bg-card border border-zt-border rounded-xl shadow-2xl w-[480px] max-w-[95vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zt-border">
          <span className="text-[15px] font-medium text-zt-text-primary">
            {initial ? t("orgs.editTitle") : t("orgs.createTitle")}
          </span>
          <button type="button" onClick={onClose} className="text-zt-text-tertiary hover:text-zt-text-primary text-xl px-1">×</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={labelCls}>{t("orgs.name")} *</label>
            <input
              required
              className={fieldCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ZLZ Zentrallabor AG"
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls}>{t("orgs.gln")} *</label>
            <input
              required
              className={`${fieldCls}${glnError ? " border-zt-danger" : gln.length === 13 && !glnError ? " border-zt-success" : ""}`}
              value={gln}
              onChange={(e) => handleGlnChange(e.target.value)}
              placeholder="7601000000000"
              maxLength={13}
            />
            {glnError && <p className="mt-1 text-[11px] text-zt-danger">{glnError}</p>}
            {!glnError && gln.length === 13 && <p className="mt-1 text-[11px] text-zt-success">✓ Gültige GLN</p>}
            <p className="mt-0.5 text-[10px] text-zt-text-tertiary">13 Stellen · EAN-13 Prüfziffer · Schweiz: 760… · Liechtenstein: 760…</p>
          </div>
          <div>
            <label className={labelCls}>{t("orgs.parent")}</label>
            <select
              className={fieldCls}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">{t("orgs.parentNone")}</option>
              {parentOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name} {o.gln ? `(${o.gln})` : ""}</option>
              ))}
            </select>
            <p className="mt-0.5 text-[10px] text-zt-text-tertiary">{t("orgs.parentHint")}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-zt-border">
          {error ? <span className="text-[12px] text-zt-danger">{error}</span> : <span />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-[13px] px-4 py-2 rounded-lg border border-zt-border bg-zt-bg-card text-zt-text-primary hover:bg-zt-bg-page transition-colors">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={saving} className="text-[13px] px-4 py-2 rounded-lg bg-zt-primary text-zt-text-on-primary hover:bg-zt-primary/90 disabled:opacity-40 transition-colors">
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <tr key={i} className="border-b border-zt-border/50 last:border-0">
          {Array.from({ length: 5 }, (__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-zt-bg-muted animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── OrganizationsPage ──────────────────────────────────────────────────────────

function OrganizationsPageInner() {
  const { t } = useTranslation();
  const { organizations, loading, error: loadError, createOrg, updateOrg, deleteOrg } = useFhirOrganizations();
  const { addTrace } = useDebugContext();

  const [showCreate,  setShowCreate]  = useState(false);
  const [editOrg,     setEditOrg]     = useState<FhirOrganizationDto | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [modalError,  setModalError]  = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [flash,       setFlash]       = useState<FlashMsg>(null);
  const [conflictOrg,  setConflictOrg]  = useState<FhirOrganizationDto | null>(null);
  const [conflictRefs, setConflictRefs] = useState<Array<{ resourceType: string; id: string; display: string }>>([]);

  function showFlash(text: string, ok: boolean) {
    setFlash({ text, ok });
    setTimeout(() => setFlash(null), 3000);
  }

  const handleCreate = useCallback(async (dto: CreateOrganizationRequestDto) => {
    setSaving(true);
    setModalError(null);
    try {
      await createOrg(dto);
      setShowCreate(false);
      showFlash(t("orgs.createOk"), true);
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [createOrg, t]);

  const handleEdit = useCallback(async (dto: CreateOrganizationRequestDto) => {
    if (!editOrg) return;
    setSaving(true);
    setModalError(null);
    try {
      await updateOrg(editOrg.id, { name: dto.name, gln: dto.gln, ...(dto.parentId ? { parentId: dto.parentId } : {}) });
      setEditOrg(null);
      showFlash(t("orgs.editOk"), true);
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [editOrg, updateOrg, t]);

  const handleDelete = useCallback(async (org: FhirOrganizationDto) => {
    if (!window.confirm(`${t("orgs.deleteConfirm")}\n${org.name} (GLN ${org.gln})`)) return;
    setDeletingId(org.id);
    try {
      await deleteOrg(org.id);
      showFlash(t("orgs.deleteOk"), true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "orgHasReferences") {
        // Fetch which resources reference this org and show a conflict dialog
        const res = await tracedFetch(addTrace, `/api/fhir/organizations/${org.id}/references`).catch(() => null);
        const refs = res?.ok ? ((await res.json().catch(() => ({ references: [] }))) as { references: Array<{ resourceType: string; id: string; display: string }> }).references : [];
        setConflictOrg(org);
        setConflictRefs(refs);
      } else {
        const key = msg === "orgDeleteFailed" ? "orgs.deleteFailed"
                  : msg === "orgNotFound"      ? "orgs.deleteNotFound"
                  : null;
        showFlash(key ? t(key) : msg, false);
      }
    } finally {
      setDeletingId(null);
    }
  }, [deleteOrg, t]);

  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />

      {showCreate && (
        <CreateModal
          allOrgs={organizations}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
          saving={saving}
          error={modalError}
          t={t}
        />
      )}
      {editOrg && (
        <CreateModal
          initial={editOrg}
          allOrgs={organizations}
          onSave={handleEdit}
          onClose={() => setEditOrg(null)}
          saving={saving}
          error={modalError}
          t={t}
        />
      )}

      {/* Conflict dialog — shown when org cannot be deleted due to existing references */}
      {conflictOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-zt-bg-card border border-zt-danger-border rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-[15px] font-semibold text-zt-danger mb-1">{t("orgs.conflictTitle")}</h2>
            <p className="text-[13px] text-zt-text-secondary mb-4">
              {t("orgs.conflictBody").replace("{name}", conflictOrg.name)}
            </p>
            {conflictRefs.length > 0 && (
              <ul className="mb-4 space-y-1 max-h-48 overflow-y-auto">
                {conflictRefs.map((r) => (
                  <li key={`${r.resourceType}/${r.id}`} className="flex items-center gap-2 text-[12px]">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zt-bg-muted text-zt-text-secondary border border-zt-border">
                      {r.resourceType}
                    </span>
                    <span className="text-zt-text-primary">{r.display}</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => { setConflictOrg(null); setConflictRefs([]); }}
              className="w-full py-2 rounded-lg bg-zt-bg-page border border-zt-border text-[13px] text-zt-text-primary hover:bg-zt-bg-muted transition-colors cursor-pointer"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[960px] mx-auto">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary mb-4">
            <BackButton />
            <span className="text-zt-text-tertiary">|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("orgs.title")}</span>
          </nav>

          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[20px] font-medium text-zt-text-primary">{t("orgs.title")}</h1>
              <p className="text-[13px] text-zt-text-tertiary mt-0.5">{t("orgs.subtitle")}</p>
            </div>
            <div className="flex items-center gap-3">
              <Flash msg={flash} />
              <button
                onClick={() => { setModalError(null); setShowCreate(true); }}
                className="flex items-center gap-1.5 text-[13px] px-3.5 py-[7px] rounded-lg bg-zt-primary text-zt-text-on-primary hover:bg-zt-primary/90 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {t("orgs.createBtn")}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-zt-bg-card border border-zt-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-zt-bg-page">
                  {[t("orgs.colName"), t("orgs.colGln"), t("orgs.colParent"), "FHIR ID", ""].map((h, i) => (
                    <th
                      key={i}
                      className="text-left text-[11px] font-medium text-zt-text-secondary uppercase tracking-[0.04em] px-4 py-2.5 border-b border-zt-border whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonRows />}
                {!loading && loadError && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-[13px] text-zt-danger">{loadError}</td></tr>
                )}
                {!loading && !loadError && organizations.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-zt-text-tertiary">{t("orgs.noResults")}</td></tr>
                )}
                {!loading && !loadError && organizations.map((org) => (
                  <tr key={org.id} className="border-b border-zt-border/50 last:border-0 hover:bg-zt-bg-page transition-colors">
                    <td className="px-4 py-[11px] text-[13px] font-medium text-zt-text-primary">{org.name || <span className="italic text-zt-text-tertiary">—</span>}</td>
                    <td className="px-4 py-[11px] text-[13px] font-mono text-zt-text-secondary">{org.gln}</td>
                    <td className="px-4 py-[11px] text-[12px] text-zt-text-secondary">
                      {org.parentName
                        ? <span className="flex items-center gap-1"><span className="text-zt-text-tertiary">↳</span>{org.parentName}</span>
                        : <span className="text-zt-text-tertiary">—</span>}
                    </td>
                    <td className="px-4 py-[11px] text-[12px] font-mono text-zt-text-tertiary">{org.id}</td>
                    <td className="px-4 py-[11px] text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => { setModalError(null); setEditOrg(org); }}
                          className="text-[12px] px-2.5 py-1 rounded border border-zt-border text-zt-text-secondary hover:bg-zt-bg-page hover:text-zt-text-primary transition-colors"
                        >
                          {t("common.edit")}
                        </button>
                        <Link
                          href="/admin/users"
                          className="text-[12px] px-2.5 py-1 rounded border border-zt-primary-border text-zt-primary hover:bg-zt-primary-light transition-colors whitespace-nowrap"
                        >
                          {t("orgs.assignBtn")}
                        </Link>
                        <button
                          onClick={() => handleDelete(org)}
                          disabled={deletingId === org.id}
                          className="text-[12px] px-2.5 py-1 rounded border border-zt-danger-border text-zt-danger hover:bg-zt-danger-light disabled:opacity-40 transition-colors"
                        >
                          {deletingId === org.id ? "…" : t("common.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Info banner */}
          <div className="mt-5 rounded-lg border border-zt-primary-border bg-zt-primary-light px-4 py-3 text-[12px] text-zt-primary">
            {t("orgs.assignHint")}
            <Link href="/admin/users" className="ml-1 underline hover:no-underline">{t("nav.adminUsers")}</Link>
          </div>

          <DebugPanel />

        </div>
      </div>
    </div>
  );
}

export default function OrganizationsPage() {
  const debugEnabled = useDebugMode();
  return (
    <DebugProvider enabled={debugEnabled}>
      <OrganizationsPageInner />
    </DebugProvider>
  );
}
