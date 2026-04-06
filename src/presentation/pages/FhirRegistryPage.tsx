"use client";

/**
 * FhirRegistryPage — Admin page for FHIR Organisation / Practitioner registry.
 *
 * Enforces the creation order:
 *   1. Organisation  (GLN required, unique)
 *   2. Practitioner  (GLN required, Organisation required, Role required)
 *   3. Users         → link to /admin/users
 */

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { validateGln, sanitizeGln } from "@/shared/utils/swissValidators";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { useFhirOrganizations } from "@/presentation/hooks/useFhirOrganizations";
import { useFhirPractitioners } from "@/presentation/hooks/useFhirPractitioners";
import { useRoles } from "@/presentation/hooks/useRoles";
import { useTranslation } from "@/lib/i18n";
import type {
  FhirOrganizationDto,
  FhirPractitionerDto,
  CreateOrganizationRequestDto,
  CreatePractitionerRequestDto,
  UpdatePractitionerRequestDto,
} from "@/infrastructure/api/dto/FhirRegistryDto";
import type { RoleCatalogEntryDto } from "@/infrastructure/api/dto/RoleDto";

// ── Shared style constants ─────────────────────────────────────────────────────

const fieldCls = "w-full px-3 py-2 text-[13px] border border-zt-border rounded-lg bg-zt-bg-page text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary focus:ring-2 focus:ring-zt-primary/10";
const labelCls = "block text-[12px] font-medium text-zt-text-secondary mb-1";

// ── Flash helper ───────────────────────────────────────────────────────────────

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

// ── Skeleton rows ──────────────────────────────────────────────────────────────

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <tr key={i} className="border-b border-zt-border/50 last:border-0">
          {Array.from({ length: cols }, (__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-zt-bg-muted animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Organisation form modal (create + edit) ───────────────────────────────────

interface OrgModalProps {
  initial?: FhirOrganizationDto;
  onSave:  (dto: CreateOrganizationRequestDto) => Promise<void>;
  onClose: () => void;
  saving:  boolean;
  error:   string | null;
  t:       (k: string) => string;
}

function OrgModal({ initial, onSave, onClose, saving, error, t }: OrgModalProps) {
  const [name,     setName]     = useState(initial?.name ?? "");
  const [gln,      setGln]      = useState(initial?.gln  ?? "");
  const [glnError, setGlnError] = useState<string | null>(null);

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
    await onSave({ name: name.trim(), gln: gln.trim() });
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
            {initial ? t("orgs.editTitle") : t("fhirRegistry.orgCreateTitle")}
          </span>
          <button type="button" onClick={onClose} className="text-zt-text-tertiary hover:text-zt-text-primary text-xl px-1">×</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={labelCls}>{t("fhirRegistry.orgName")} *</label>
            <input required className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="ZLZ Zentrallabor AG" />
          </div>
          <div>
            <label className={labelCls}>{t("fhirRegistry.orgGln")} *</label>
            <input
              required
              className={`${fieldCls}${glnError ? " border-zt-danger" : gln.length === 13 && !glnError ? " border-zt-success" : ""}`}
              value={gln}
              onChange={(e) => handleGlnChange(e.target.value)}
              placeholder={t("fhirRegistry.orgGlnPlaceholder")}
              maxLength={13}
            />
            {glnError && <p className="mt-1 text-[11px] text-zt-danger">{glnError}</p>}
            {!glnError && gln.length === 13 && <p className="mt-1 text-[11px] text-zt-success">✓ Gültige GLN</p>}
            <p className="mt-0.5 text-[10px] text-zt-text-tertiary">13 Stellen, Schweiz beginnt mit 760, Liechtenstein mit 760</p>
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

// ── Practitioner form modal ────────────────────────────────────────────────────

interface PractModalProps {
  organizations: FhirOrganizationDto[];
  roles:         RoleCatalogEntryDto[];
  initial?:      FhirPractitionerDto;
  onSave:        (dto: CreatePractitionerRequestDto) => Promise<void>;
  onSaveEdit?:   (dto: UpdatePractitionerRequestDto) => Promise<void>;
  onClose:       () => void;
  saving:        boolean;
  error:         string | null;
  t:             (k: string) => string;
}

function PractModal({ organizations, roles, initial, onSave, onSaveEdit, onClose, saving, error, t }: PractModalProps) {
  const isEdit = Boolean(initial);
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName,  setLastName]  = useState(initial?.lastName  ?? "");
  const [gln,       setGln]       = useState(initial?.gln       ?? "");
  const [glnError,  setGlnError]  = useState<string | null>(null);
  const [orgId,     setOrgId]     = useState(initial?.organizationId ?? organizations[0]?.id ?? "");
  const [roleCode,  setRoleCode]  = useState(initial?.roleCode  ?? roles[0]?.code ?? "");

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

  // Sync orgId when organizations load (avoids empty select after async fetch)
  useEffect(() => {
    if (organizations.length > 0 && !orgId) setOrgId(organizations[0]!.id);
  }, [organizations, orgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (gln.trim()) {
      const v = validateGln(gln);
      if (!v.valid) { setGlnError(v.error ?? "GLN ungültig"); return; }
    } else if (!isEdit) {
      setGlnError("GLN ist erforderlich"); return;
    }
    if (isEdit && onSaveEdit) {
      await onSaveEdit({ roleCode, organizationId: orgId, ...(gln.trim() ? { gln: gln.trim() } : {}) });
    } else {
      await onSave({
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        gln:       gln.trim(),
        organizationId: orgId,
        roleCode,
      });
    }
  }

  const selectCls = fieldCls;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-zt-bg-card border border-zt-border rounded-xl shadow-2xl w-[520px] max-w-[95vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zt-border">
          <span className="text-[15px] font-medium text-zt-text-primary">
            {isEdit ? t("fhirRegistry.practEditTitle") : t("fhirRegistry.practCreateTitle")}
          </span>
          <button type="button" onClick={onClose} className="text-zt-text-tertiary hover:text-zt-text-primary text-xl px-1">×</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {!isEdit && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t("fhirRegistry.practFirstName")} *</label>
                  <input required className={fieldCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Hans" />
                </div>
                <div>
                  <label className={labelCls}>{t("fhirRegistry.practLastName")} *</label>
                  <input required className={fieldCls} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Müller" />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t("fhirRegistry.practGln")} *</label>
                <input
                  required
                  className={`${fieldCls}${glnError ? " border-zt-danger" : gln.length === 13 && !glnError ? " border-zt-success" : ""}`}
                  value={gln}
                  onChange={(e) => handleGlnChange(e.target.value)}
                  placeholder={t("fhirRegistry.orgGlnPlaceholder")}
                  maxLength={13}
                />
                {glnError && <p className="mt-1 text-[11px] text-zt-danger">{glnError}</p>}
                {!glnError && gln.length === 13 && <p className="mt-1 text-[11px] text-zt-success">✓ Gültige GLN</p>}
              </div>
            </>
          )}
          {isEdit && (
            <>
              <div className="rounded-lg bg-zt-bg-page border border-zt-border px-3 py-2 text-[13px] text-zt-text-secondary">
                {initial!.lastName}, {initial!.firstName}
              </div>
              <div>
                <label className={labelCls}>{t("fhirRegistry.practGln")}</label>
                <input
                  className={`${fieldCls}${glnError ? " border-zt-danger" : gln.length === 13 && !glnError ? " border-zt-success" : ""}`}
                  value={gln}
                  onChange={(e) => handleGlnChange(e.target.value)}
                  placeholder={t("fhirRegistry.orgGlnPlaceholder")}
                  maxLength={13}
                />
                {glnError && <p className="mt-1 text-[11px] text-zt-danger">{glnError}</p>}
                {!glnError && gln.length === 13 && <p className="mt-1 text-[11px] text-zt-success">✓ Gültige GLN</p>}
                <p className="mt-0.5 text-[10px] text-zt-text-tertiary">13 Stellen · Schweiz: 760xxxx · Liechtenstein: 760xxxx</p>
              </div>
            </>
          )}
          <div>
            <label className={labelCls}>{t("fhirRegistry.practOrg")} *</label>
            <select required className={selectCls} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">{t("fhirRegistry.practOrgPlaceholder")}</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.gln})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("fhirRegistry.practRole")} *</label>
            <select required className={selectCls} value={roleCode} onChange={(e) => setRoleCode(e.target.value)}>
              <option value="">{t("fhirRegistry.practRolePlaceholder")}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.code}>{r.display} ({r.code})</option>
              ))}
            </select>
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

// ── Organisations tab ──────────────────────────────────────────────────────────

function OrgsTab({ t }: { t: (k: string) => string }) {
  const { organizations, loading, error, createOrg, updateOrg, deleteOrg } = useFhirOrganizations();
  const [editOrg,    setEditOrg]    = useState<FhirOrganizationDto | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flash,      setFlash]      = useState<FlashMsg>(null);

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
      showFlash(t("fhirRegistry.orgCreateOk"), true);
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
      await updateOrg(editOrg.id, { name: dto.name, gln: dto.gln });
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
      showFlash(e instanceof Error ? e.message : String(e), false);
    } finally {
      setDeletingId(null);
    }
  }, [deleteOrg, t]);

  return (
    <div>
      {showCreate && (
        <OrgModal
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
          saving={saving}
          error={modalError}
          t={t}
        />
      )}
      {editOrg && (
        <OrgModal
          initial={editOrg}
          onSave={handleEdit}
          onClose={() => setEditOrg(null)}
          saving={saving}
          error={modalError}
          t={t}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-medium text-zt-text-primary">{t("fhirRegistry.orgTitle")}</h2>
        <div className="flex items-center gap-2">
          <Flash msg={flash} />
          <button
            onClick={() => { setModalError(null); setShowCreate(true); }}
            className="flex items-center gap-1.5 text-[13px] px-3.5 py-[7px] rounded-lg bg-zt-primary text-zt-text-on-primary hover:bg-zt-primary/90 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {t("fhirRegistry.orgCreateBtn")}
          </button>
        </div>
      </div>

      <div className="bg-zt-bg-card border border-zt-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-zt-bg-page">
              {[t("fhirRegistry.orgName"), t("fhirRegistry.orgGln"), "FHIR ID", ""].map((h, i) => (
                <th key={i} className="text-left text-[11px] font-medium text-zt-text-secondary uppercase tracking-[0.04em] px-4 py-2.5 border-b border-zt-border whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows cols={4} />}
            {!loading && error && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-zt-danger">{error}</td></tr>
            )}
            {!loading && !error && organizations.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-[13px] text-zt-text-tertiary">{t("fhirRegistry.orgNoResults")}</td></tr>
            )}
            {!loading && !error && organizations.map((o) => (
              <tr key={o.id} className="border-b border-zt-border/50 last:border-0 hover:bg-zt-bg-page transition-colors">
                <td className="px-4 py-[11px] text-[13px] font-medium text-zt-text-primary">{o.name || <span className="italic text-zt-text-tertiary">—</span>}</td>
                <td className="px-4 py-[11px] text-[13px] font-mono text-zt-text-secondary">{o.gln}</td>
                <td className="px-4 py-[11px] text-[12px] font-mono text-zt-text-tertiary">{o.id}</td>
                <td className="px-4 py-[11px] text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => { setModalError(null); setEditOrg(o); }}
                      className="text-[12px] px-2.5 py-1 rounded border border-zt-border text-zt-text-secondary hover:bg-zt-bg-page hover:text-zt-text-primary transition-colors"
                    >
                      {t("common.edit")}
                    </button>
                    <Link
                      href={`/admin/users`}
                      className="text-[12px] px-2.5 py-1 rounded border border-zt-primary-border text-zt-primary hover:bg-zt-primary-light transition-colors whitespace-nowrap"
                      title={t("orgs.assignBtn")}
                    >
                      {t("orgs.assignBtn")}
                    </Link>
                    <button
                      onClick={() => handleDelete(o)}
                      disabled={deletingId === o.id}
                      className="text-[12px] px-2.5 py-1 rounded border border-zt-danger-border text-zt-danger hover:bg-zt-danger-light disabled:opacity-40 transition-colors"
                    >
                      {deletingId === o.id ? "…" : t("common.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Practitioners tab ──────────────────────────────────────────────────────────

function PractsTab({ t }: { t: (k: string) => string }) {
  const { organizations, loading: orgsLoading } = useFhirOrganizations();
  const { practitioners, loading, error, createPractitioner, updatePractitioner } = useFhirPractitioners();
  const { roles } = useRoles();

  const [showCreate,  setShowCreate]  = useState(false);
  const [editPract,   setEditPract]   = useState<FhirPractitionerDto | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [modalError,  setModalError]  = useState<string | null>(null);
  const [flash,       setFlash]       = useState<FlashMsg>(null);

  const noOrgs   = !orgsLoading && organizations.length === 0;
  const orgsReady = !orgsLoading && organizations.length > 0;

  function showFlash(text: string, ok: boolean) {
    setFlash({ text, ok });
    setTimeout(() => setFlash(null), 3000);
  }

  const handleCreate = useCallback(async (dto: CreatePractitionerRequestDto) => {
    setSaving(true);
    setModalError(null);
    try {
      await createPractitioner(dto);
      setShowCreate(false);
      showFlash(t("fhirRegistry.practCreateOk"), true);
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [createPractitioner, t]);

  const handleEdit = useCallback(async (dto: UpdatePractitionerRequestDto) => {
    if (!editPract) return;
    setSaving(true);
    setModalError(null);
    try {
      await updatePractitioner(editPract.practitionerRoleId, dto);
      setEditPract(null);
      showFlash(t("fhirRegistry.practEditOk"), true);
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [editPract, updatePractitioner, t]);

  return (
    <div>
      {showCreate && (
        <PractModal
          organizations={organizations}
          roles={roles}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
          saving={saving}
          error={modalError}
          t={t}
        />
      )}
      {editPract && (
        <PractModal
          organizations={organizations}
          roles={roles}
          initial={editPract}
          onSave={handleCreate}
          onSaveEdit={handleEdit}
          onClose={() => setEditPract(null)}
          saving={saving}
          error={modalError}
          t={t}
        />
      )}

      {noOrgs && (
        <div className="mb-4 rounded-lg border border-zt-warning-border bg-zt-warning-bg px-4 py-3 text-[13px] text-zt-warning-text">
          ⚠ {t("fhirRegistry.practNoOrg")}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-medium text-zt-text-primary">{t("fhirRegistry.practTitle")}</h2>
        <div className="flex items-center gap-2">
          <Flash msg={flash} />
          <button
            onClick={() => { setModalError(null); setShowCreate(true); }}
            disabled={!orgsReady}
            title={orgsLoading ? t("common.loading") : noOrgs ? t("fhirRegistry.practNoOrg") : undefined}
            className="flex items-center gap-1.5 text-[13px] px-3.5 py-[7px] rounded-lg bg-zt-primary text-zt-text-on-primary hover:bg-zt-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {orgsLoading ? t("common.loading") : t("fhirRegistry.practCreateBtn")}
          </button>
        </div>
      </div>

      <div className="bg-zt-bg-card border border-zt-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-zt-bg-page">
              {[t("fhirRegistry.practName"), t("fhirRegistry.practGln"), t("fhirRegistry.practOrg"), t("fhirRegistry.practRole"), ""].map((h, i) => (
                <th key={i} className="text-left text-[11px] font-medium text-zt-text-secondary uppercase tracking-[0.04em] px-4 py-2.5 border-b border-zt-border whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows cols={5} />}
            {!loading && error && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px] text-zt-danger">{error}</td></tr>
            )}
            {!loading && !error && practitioners.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[13px] text-zt-text-tertiary">{t("fhirRegistry.practNoResults")}</td></tr>
            )}
            {!loading && !error && practitioners.map((p) => (
              <tr key={p.practitionerRoleId} className="border-b border-zt-border/50 last:border-0 hover:bg-zt-bg-page transition-colors">
                <td className="px-4 py-[11px] text-[13px] font-medium text-zt-text-primary">{p.lastName}, {p.firstName}</td>
                <td className="px-4 py-[11px] text-[13px] font-mono text-zt-text-secondary">{p.gln}</td>
                <td className="px-4 py-[11px] text-[13px] text-zt-text-secondary">{p.organizationName || p.organizationId || <span className="italic text-zt-text-tertiary">—</span>}</td>
                <td className="px-4 py-[11px]">
                  {p.roleDisplay || p.roleCode
                    ? (
                      <span title={p.roleCode} className="text-[13px] text-zt-text-secondary">
                        {p.roleDisplay || p.roleCode}
                      </span>
                    )
                    : <span className="italic text-[12px] text-zt-text-tertiary">—</span>
                  }
                </td>
                <td className="px-4 py-[11px] text-right">
                  <button
                    onClick={() => { setModalError(null); setEditPract(p); }}
                    className="text-[12px] px-2.5 py-1 rounded border border-zt-border text-zt-text-secondary hover:bg-zt-bg-page hover:text-zt-text-primary transition-colors"
                  >
                    {t("common.edit")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Users tab ──────────────────────────────────────────────────────────────────

function UsersTab({ t }: { t: (k: string) => string }) {
  return (
    <div className="rounded-xl border border-zt-border bg-zt-bg-card px-6 py-8 text-center space-y-4">
      <div className="text-[32px]">👤</div>
      <p className="text-[14px] text-zt-text-primary font-medium">{t("fhirRegistry.usersNote")}</p>
      <p className="text-[13px] text-zt-text-secondary">{t("fhirRegistry.usersTab")}</p>
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-lg bg-zt-primary text-zt-text-on-primary hover:bg-zt-primary/90 transition-colors"
      >
        {t("fhirRegistry.usersLink")} →
      </Link>
    </div>
  );
}

// ── FhirRegistryPage ───────────────────────────────────────────────────────────

type Tab = "orgs" | "practitioners" | "users";

export default function FhirRegistryPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab | null) ?? "orgs";
  const [activeTab, setActiveTab] = useState<Tab>(
    ["orgs", "practitioners", "users"].includes(initialTab) ? initialTab : "orgs",
  );

  const tabs: { id: Tab; label: string; step: string }[] = [
    { id: "orgs",          label: t("fhirRegistry.tabOrgs"),          step: "① " },
    { id: "practitioners", label: t("fhirRegistry.tabPractitioners"), step: "② " },
    { id: "users",         label: t("fhirRegistry.tabUsers"),         step: "③ " },
  ];

  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />

      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[960px] mx-auto">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary mb-4">
            <BackButton />
            <span className="text-zt-text-tertiary">|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("fhirRegistry.title")}</span>
          </nav>

          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-[20px] font-medium text-zt-text-primary">{t("fhirRegistry.title")}</h1>
            <p className="text-[13px] text-zt-text-tertiary mt-0.5">{t("fhirRegistry.subtitle")}</p>
          </div>

          {/* Step banner */}
          <div className="mb-6 rounded-lg border border-zt-primary-border bg-zt-primary-light px-4 py-3">
            <p className="text-[12px] text-zt-primary font-medium">{t("fhirRegistry.stepBanner")}</p>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-6 border-b border-zt-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-[13px] border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? "border-zt-primary text-zt-primary font-medium"
                    : "border-transparent text-zt-text-secondary hover:text-zt-text-primary"
                }`}
              >
                {tab.step}{tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "orgs"          && <OrgsTab   t={t} />}
          {activeTab === "practitioners" && <PractsTab t={t} />}
          {activeTab === "users"         && <UsersTab  t={t} />}

        </div>
      </div>
    </div>
  );
}
