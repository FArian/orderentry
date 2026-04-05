"use client";

/**
 * UsersPage — Admin user management UI.
 *
 * Layout follows the same AppSidebar pattern as OrdersPage / ResultsPage.
 * Features:
 *   - List users with status / FHIR sync / role badges
 *   - Create user modal (local or external/LDAP)
 *   - Edit user modal (role, status, profile)
 *   - Per-row FHIR Sync, Delete actions
 *   - Stats row: Total / Admins / Pending sync / Errors
 */

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import type { FhirOrganizationDto } from "@/infrastructure/api/dto/FhirRegistryDto";
import { Badge } from "@/presentation/ui/Badge";
import { RoleTagInput } from "@/presentation/ui/RoleTagInput";
import { useUsers } from "@/presentation/hooks/useUsers";
import { useRoles } from "@/presentation/hooks/useRoles";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/shared/utils/formatDate";
import { validateGln, sanitizeGln } from "@/shared/utils/swissValidators";
import type { UserResponseDto, CreateUserRequestDto, UpdateUserRequestDto } from "@/infrastructure/api/dto/UserDto";
import type { RoleCatalogEntryDto } from "@/infrastructure/api/dto/RoleDto";
import type { BadgeVariant } from "@/presentation/ui/Badge";
import { ROLE_PERMISSION_MAP } from "@/domain/policies/RolePermissionMap";
import { ASSIGNABLE_PERMISSIONS } from "@/domain/valueObjects/Permission";

// ── Status / role badge helpers ───────────────────────────────────────────────

function syncVariant(s: string): BadgeVariant {
  if (s === "synced")    return "success";
  if (s === "error")     return "danger";
  return "neutral";
}
function syncIcon(s: string) {
  if (s === "synced")    return "✅";
  if (s === "error")     return "⚠️";
  return "⏳";
}
function syncLabel(s: string, t: (k: string) => string) {
  if (s === "synced")    return t("users.syncSynced");
  if (s === "error")     return t("users.syncError");
  return t("users.syncPending");
}

function roleVariant(r: string): BadgeVariant {
  return r === "admin" ? "info" : "neutral";
}

function statusVariant(s: string): BadgeVariant {
  if (s === "active")    return "success";
  if (s === "pending")   return "warning";
  if (s === "suspended") return "danger";
  return "neutral";
}
function statusLabel(s: string, t: (k: string) => string) {
  if (s === "active")    return t("users.statusActive");
  if (s === "pending")   return t("users.statusPending");
  if (s === "suspended") return t("users.statusSuspended");
  return s;
}

// ── UserFormModal ─────────────────────────────────────────────────────────────

interface UserFormModalProps {
  mode: "create" | "edit";
  initial?: UserResponseDto;
  catalog: RoleCatalogEntryDto[];
  onSave: (data: CreateUserRequestDto | UpdateUserRequestDto) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  t: (k: string) => string;
}

function inferPtype(profile?: UserResponseDto["profile"]): string {
  if (profile?.ptype) return profile.ptype;
  // Legacy users (created before ptype was mandatory): infer from profile shape.
  // JUR users always have `organization` set and no firstName/lastName.
  if (profile?.organization && !profile?.firstName && !profile?.lastName) return "JUR";
  return "";
}

function UserFormModal({ mode, initial, catalog, onSave, onClose, saving, error, t }: UserFormModalProps) {
  const [username,     setUsername]     = useState(initial?.username     ?? "");
  const [password,     setPassword]     = useState("");
  const [providerType, setProviderType] = useState<"local" | "external">(initial?.providerType ?? "local");
  const [externalId,   setExternalId]   = useState(initial?.externalId  ?? "");
  const [role,         setRole]         = useState<"admin" | "user">(initial?.role ?? "user");
  const [status,       setStatus]       = useState<"active" | "pending" | "suspended">(initial?.status ?? "active");
  const [firstName,    setFirstName]    = useState(initial?.profile?.firstName   ?? "");
  const [lastName,     setLastName]     = useState(initial?.profile?.lastName    ?? "");
  const [email,        setEmail]        = useState(initial?.profile?.email       ?? "");
  const [gln,          setGln]          = useState(initial?.profile?.gln         ?? "");
  const [ptype,        setPtype]        = useState(() => inferPtype(initial?.profile));
  const [roleTypes,    setRoleTypes]    = useState<string[]>(initial?.profile?.roleTypes ?? []);
  const [glnError,      setGlnError]     = useState<string | null>(null);
  const [ahv,           setAhv]          = useState(initial?.profile?.ahv          ?? "");
  const [orgFhirId,     setOrgFhirId]    = useState(initial?.profile?.orgFhirId    ?? "");
  const [orgGln,        setOrgGln]       = useState(initial?.profile?.orgGln       ?? "");
  const [orgName,       setOrgName]      = useState(initial?.profile?.orgName      ?? "");
  const [organization,  setOrganization] = useState(initial?.profile?.organization ?? "");
  const [locationId,    setLocationId]   = useState(initial?.profile?.locationId   ?? "");
  const [zsr,           setZsr]          = useState(initial?.profile?.zsr          ?? "");
  const [uid,           setUid]          = useState(initial?.profile?.uid          ?? "");
  const [bur,           setBur]          = useState(initial?.profile?.bur          ?? "");
  const [locationName,        setLocationName]        = useState(initial?.profile?.locationName ?? "");
  const [fhirPractitionerId,  setFhirPractitionerId]  = useState(initial?.fhirPractitionerId   ?? "");
  const [orgs,                setOrgs]                = useState<FhirOrganizationDto[]>([]);
  const [locations,           setLocations]           = useState<{ id: string; name: string }[]>([]);

  const GLN_SYSTEMS = ["https://www.gs1.org/gln", "urn:oid:2.51.1.3"];

  useEffect(() => {
    fetch("/api/fhir/organizations", { cache: "no-store" })
      .then((r) => r.json())
      .then((bundle: { entry?: Array<{ resource?: { id?: string; name?: string; identifier?: Array<{ system?: string; value?: string }> } }> }) => {
        const mapped: FhirOrganizationDto[] = (bundle.entry ?? [])
          .map((e) => e.resource)
          .filter((r): r is NonNullable<typeof r> => !!r?.id)
          .map((r) => ({
            id:   r.id!,
            name: r.name ?? r.id!,
            gln:  r.identifier?.find((i) => GLN_SYSTEMS.includes(i.system ?? ""))?.value ?? "",
          }));
        setOrgs(mapped);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fetchLocations(orgId: string) {
    if (!orgId) { setLocations([]); return; }
    fetch(`/api/fhir/locations?organization=${encodeURIComponent(orgId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((bundle: { entry?: Array<{ resource?: { id?: string; name?: string } }> }) => {
        const mapped = (bundle.entry ?? [])
          .map((e) => e.resource)
          .filter((r): r is NonNullable<typeof r> => !!r?.id)
          .map((r) => ({ id: r.id!, name: r.name ?? r.id! }));
        setLocations(mapped);
      })
      .catch(() => {});
  }

  function handleOrgSelect(id: string) {
    if (!id) {
      setOrgFhirId(""); setOrgGln(""); setOrgName("");
      setLocationId(""); setLocationName(""); setLocations([]);
      return;
    }
    const org = orgs.find((o) => o.id === id);
    if (org) {
      setOrgFhirId(org.id); setOrgGln(org.gln); setOrgName(org.name);
      setLocationId(""); setLocationName("");
      if (ptype === "NAT") fetchLocations(org.id);
    }
  }

  function handleLocationSelect(id: string) {
    if (!id) { setLocationId(""); setLocationName(""); return; }
    const loc = locations.find((l) => l.id === id);
    if (loc) { setLocationId(loc.id); setLocationName(loc.name); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // GLN required for NAT (Practitioner) and JUR (Organisation)
    if ((ptype === "NAT" || ptype === "JUR") && !gln.trim()) {
      setGlnError(t("roles.glnRequired")); return;
    }
    if (gln.trim()) {
      const v = validateGln(gln);
      if (!v.valid) { setGlnError(v.error ?? "GLN ungültig"); return; }
    }
    setGlnError(null);

    // ptype is mandatory for all users
    if (!ptype) { alert(t("users.ptypeRequired")); return; }

    // NAT: org + location + at least one roleType required
    if (ptype === "NAT") {
      if (!orgFhirId) { alert(t("users.orgRequired")); return; }
      if (!locationId) { alert(t("users.locationRequired")); return; }
      if (roleTypes.length === 0) { alert(t("users.roleTypeRequired")); return; }
    }

    const profile = {
      ptype,
      // NAT / PER — person fields
      ...(ptype !== "JUR" && firstName  && { firstName }),
      ...(ptype !== "JUR" && lastName   && { lastName }),
      ...(ptype !== "JUR" && ahv        && { ahv }),
      // JUR — org name stored in organization field
      ...(ptype === "JUR" && organization && { organization }),
      ...(email            && { email }),
      ...(gln              && { gln }),
      // NAT only: roles + location + ZSR
      ...(ptype === "NAT" && roleTypes.length > 0 && { roleTypes }),
      ...(locationId       && { locationId }),
      ...(locationName     && { locationName }),
      ...(ptype === "NAT" && zsr        && { zsr }),
      // JUR only: UID + BUR + ZSR
      ...(ptype === "JUR" && uid        && { uid }),
      ...(ptype === "JUR" && bur        && { bur }),
      ...(ptype === "JUR" && zsr        && { zsr }),
      // NAT + PER: org membership (JUR IS the org, doesn't reference another org)
      ...(ptype !== "JUR" && orgFhirId  && { orgFhirId }),
      ...(ptype !== "JUR" && orgGln     && { orgGln }),
      ...(ptype !== "JUR" && orgName    && { orgName }),
    };
    if (mode === "create") {
      await onSave({
        username,
        providerType,
        ...(providerType === "local"    && { password }),
        ...(providerType === "external" && { externalId }),
        role,
        status,
        ...(Object.keys(profile).length > 0 && { profile }),
      } as CreateUserRequestDto);
    } else {
      await onSave({
        role,
        status,
        ...(externalId          && { externalId }),
        ...(fhirPractitionerId  && { fhirPractitionerId }),
        profile,
      } as UpdateUserRequestDto);
    }
  }

  const fieldCls = "w-full px-3 py-2 text-[13px] border border-zt-border rounded-lg bg-zt-bg-page text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary focus:ring-2 focus:ring-zt-primary/10";
  const labelCls = "block text-[12px] font-medium text-zt-text-secondary mb-1";
  const selectCls = fieldCls;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-zt-bg-card border border-zt-border rounded-xl shadow-2xl w-[540px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zt-border">
          <span className="text-[15px] font-medium text-zt-text-primary">
            {mode === "create" ? t("users.createTitle") : t("users.editTitle")}
          </span>
          <button type="button" onClick={onClose} className="text-zt-text-tertiary hover:text-zt-text-primary text-xl px-1">×</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {mode === "create" && (
            <>
              <div>
                <label className={labelCls}>{t("users.username")} *</label>
                <input required className={fieldCls} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="bmueller" />
              </div>
              <div>
                <label className={labelCls}>{t("users.providerType")}</label>
                <select className={selectCls} value={providerType} onChange={(e) => setProviderType(e.target.value as "local" | "external")}>
                  <option value="local">{t("users.providerLocal")}</option>
                  <option value="external">{t("users.providerExternal")}</option>
                </select>
              </div>
              {providerType === "local" && (
                <div>
                  <label className={labelCls}>{t("users.password")} *</label>
                  <input required type="password" className={fieldCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
              )}
              {providerType === "external" && (
                <div>
                  <label className={labelCls}>{t("users.externalId")} *</label>
                  <input required className={fieldCls} value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="uid=bmueller,ou=users,dc=example,dc=com" />
                </div>
              )}
            </>
          )}

          {mode === "edit" && initial?.providerType === "external" && (
            <div>
              <label className={labelCls}>{t("users.externalId")}</label>
              <input className={fieldCls} value={externalId} onChange={(e) => setExternalId(e.target.value)} />
            </div>
          )}

          {/* Role + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t("users.role")}</label>
              <select className={selectCls} value={role} onChange={(e) => setRole(e.target.value as "admin" | "user")}>
                <option value="user">{t("users.roleUser")}</option>
                <option value="admin">{t("users.roleAdmin")}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("users.status")}</label>
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as "active" | "pending" | "suspended")}>
                <option value="active">{t("users.statusActive")}</option>
                <option value="pending">{t("users.statusPending")}</option>
                <option value="suspended">{t("users.statusSuspended")}</option>
              </select>
            </div>
          </div>

          {/* Profile section */}
          <div className="border-t border-zt-border pt-3">
            <p className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide mb-3">{t("users.profileSection")}</p>

            {/* ptype selector — always visible, required */}
            <div className="mb-3">
              <label className={labelCls}>{t("users.ptype")} *</label>
              <select required className={selectCls} value={ptype} onChange={(e) => {
                setPtype(e.target.value);
                setGlnError(null);
                setLocationId(""); setLocationName(""); setLocations([]);
                setRoleTypes([]);
              }}>
                <option value="">— {t("users.ptypeSelect")} —</option>
                <option value="NAT">NAT — {t("users.ptypeNAT")}</option>
                <option value="JUR">JUR — {t("users.ptypeJUR")}</option>
                <option value="PER">PER — {t("users.ptypePER")}</option>
              </select>
            </div>

            {/* JUR: organisation name */}
            {ptype === "JUR" && (
              <div className="mb-3">
                <label className={labelCls}>{t("profile.organizationName")} *</label>
                <input required className={fieldCls} value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Klinik Hirslanden AG" />
              </div>
            )}

            {/* NAT / other: first + last name */}
            {ptype !== "JUR" && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelCls}>{t("profile.firstName")}</label>
                  <input className={fieldCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{t("profile.lastName")}</label>
                  <input className={fieldCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t("profile.email")}</label>
                <input type="email" className={fieldCls} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              {/* GLN — required for NAT/JUR, optional for others */}
              <div>
                <label className={labelCls}>
                  {t("profile.gln")} {(ptype === "NAT" || ptype === "JUR") ? "*" : ""}
                </label>
                <input
                  className={`${fieldCls}${glnError ? " border-zt-danger" : ""}`}
                  value={gln}
                  onChange={(e) => {
                    const s = sanitizeGln(e.target.value);
                    setGln(s);
                    if (s.length === 13) { const v = validateGln(s); setGlnError(v.error ?? null); }
                    else setGlnError(null);
                  }}
                  placeholder="7601002145985"
                  maxLength={13}
                />
                {glnError && <p className="mt-1 text-[11px] text-zt-danger">{glnError}</p>}
                {!glnError && gln.length === 13 && <p className="mt-1 text-[11px] text-zt-success">✓ Gültige GLN</p>}
                {!ptype && <p className="mt-0.5 text-[10px] text-zt-text-tertiary">{t("profile.glnHint")}</p>}
              </div>

              {/* AHV — only for NAT and PER, not JUR */}
              {ptype !== "JUR" && (
                <div>
                  <label className={labelCls}>{t("profile.ahv")}</label>
                  <input
                    className={fieldCls}
                    value={ahv}
                    onChange={(e) => setAhv(e.target.value)}
                    placeholder="756.1234.5678.90"
                    maxLength={16}
                  />
                  <p className="mt-0.5 text-[10px] text-zt-text-tertiary">{t("profile.ahvHint")}</p>
                </div>
              )}

              {/* ZSR — NAT and JUR (billing number santésuisse) */}
              {(ptype === "NAT" || ptype === "JUR") && (
                <div>
                  <label className={labelCls}>{t("profile.zsr")}</label>
                  <input
                    className={fieldCls}
                    value={zsr}
                    onChange={(e) => setZsr(e.target.value)}
                    placeholder="K123456"
                  />
                  <p className="mt-0.5 text-[10px] text-zt-text-tertiary">{t("profile.zsrHint")}</p>
                </div>
              )}

              {/* UID — JUR only (Unternehmens-ID) */}
              {ptype === "JUR" && (
                <div>
                  <label className={labelCls}>{t("profile.uid")}</label>
                  <input
                    className={fieldCls}
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    placeholder="CHE-123.456.789"
                    maxLength={15}
                  />
                  <p className="mt-0.5 text-[10px] text-zt-text-tertiary">{t("profile.uidHint")}</p>
                </div>
              )}

              {/* BUR — JUR only (Betriebseinheitsnummer BFS) */}
              {ptype === "JUR" && (
                <div>
                  <label className={labelCls}>{t("profile.bur")}</label>
                  <input
                    className={fieldCls}
                    value={bur}
                    onChange={(e) => setBur(e.target.value)}
                    placeholder="12345678"
                    maxLength={9}
                  />
                  <p className="mt-0.5 text-[10px] text-zt-text-tertiary">{t("profile.burHint")}</p>
                </div>
              )}
            </div>

            {/* PractitionerRole (roleTypes) — NAT only, required */}
            {ptype === "NAT" && (
              <div className="mt-3">
                <RoleTagInput
                  label={`${t("roles.labelRoleTypes")} *`}
                  value={roleTypes}
                  onChange={setRoleTypes}
                  catalog={catalog}
                />
              </div>
            )}
          </div>

          {/* Organisation + Location — NAT (required) or PER (optional), not JUR */}
          {(ptype === "NAT" || ptype === "PER") && (
            <div className="border-t border-zt-border pt-3">
              <p className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide mb-3">
                {ptype === "NAT" ? t("orgs.sectionNAT") : t("orgs.sectionPER")}
              </p>
              <div>
                <label className={labelCls}>
                  {t("orgs.title")} {ptype === "NAT" ? "*" : ""}
                </label>
                <select className={selectCls} value={orgFhirId} onChange={(e) => handleOrgSelect(e.target.value)}>
                  <option value="">{t("orgs.selectNone")}</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name} — GLN {o.gln}</option>
                  ))}
                </select>
              </div>

              {/* Location — NAT only, required, filtered by selected org */}
              {ptype === "NAT" && (
                <div className="mt-3">
                  <label className={labelCls}>{t("orgs.location")} *</label>
                  {locations.length === 0 && orgFhirId ? (
                    <p className="text-[11px] text-zt-text-tertiary mt-1">{t("orgs.locationNone")}</p>
                  ) : (
                    <select
                      className={selectCls}
                      value={locationId}
                      onChange={(e) => handleLocationSelect(e.target.value)}
                      disabled={!orgFhirId}
                    >
                      <option value="">{t("orgs.selectLocation")}</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  )}
                  {!orgFhirId && (
                    <p className="mt-0.5 text-[10px] text-zt-text-tertiary">{t("orgs.selectOrgFirst")}</p>
                  )}
                </div>
              )}

              {orgFhirId && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zt-text-tertiary bg-zt-bg-page border border-zt-border rounded-lg px-3 py-2">
                  <span>FHIR ID: <span className="font-mono text-zt-text-secondary">{orgFhirId}</span></span>
                  <span>GLN: <span className="font-mono text-zt-text-secondary">{orgGln}</span></span>
                </div>
              )}
            </div>
          )}

          {/* FHIR Practitioner ID — nur im Edit-Mode, für Zugriffssteuerung */}
          {mode === "edit" && (
            <div className="pt-3 border-t border-zt-border">
              <label className={labelCls}>FHIR Practitioner ID</label>
              <input
                className={fieldCls}
                value={fhirPractitionerId}
                onChange={(e) => setFhirPractitionerId(e.target.value)}
                placeholder="prac-von-rohr-anna"
              />
              <p className="mt-1 text-[10px] text-zt-text-tertiary">
                Verknüpft diesen Benutzer mit einem FHIR-Practitioner. Bestimmt den Datenzugang beim nächsten Login.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-zt-border">
          {error ? (
            <span className="text-[12px] text-zt-danger">{error}</span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="text-[13px] px-4 py-2 rounded-lg border border-zt-border bg-zt-bg-card text-zt-text-primary hover:bg-zt-bg-page transition-colors">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={saving}
              className="text-[13px] px-4 py-2 rounded-lg bg-zt-primary text-zt-text-on-primary hover:bg-zt-primary/90 disabled:opacity-40 transition-colors">
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── UsersPage ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { t } = useTranslation();
  const { roles } = useRoles();          // role catalog for the form dropdown
  const [search, setSearch] = useState("");

  const { users, total, loading, error, page, pageSize, setPage, reload, createUser, updateUser, deleteUser, syncToFhir } =
    useUsers({ q: search });

  // Modal state
  const [modal, setModal]       = useState<null | "create" | "edit">(null);
  const [editTarget, setEditTarget] = useState<UserResponseDto | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError,  setModalError]  = useState<string | null>(null);

  // Per-row action state
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flashMsg, setFlashMsg]  = useState<{ text: string; ok: boolean } | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [savingPermId, setSavingPermId] = useState<string | null>(null);

  function togglePermissions(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function flash(text: string, ok: boolean) {
    setFlashMsg({ text, ok });
    setTimeout(() => setFlashMsg(null), 3000);
  }

  // Stats
  const stats = {
    total,
    admins:      users.filter((u) => u.role === "admin").length,
    pendingSync: users.filter((u) => u.fhirSyncStatus !== "synced").length,
    errors:      users.filter((u) => u.fhirSyncStatus === "error").length,
  };

  // ── Modal handlers ──────────────────────────────────────────────────────────

  const openCreate = () => { setEditTarget(null); setModalError(null); setModal("create"); };
  const openEdit   = (u: UserResponseDto) => { setEditTarget(u); setModalError(null); setModal("edit"); };
  const closeModal = () => { setModal(null); setEditTarget(null); };

  const handleSave = useCallback(async (data: CreateUserRequestDto | UpdateUserRequestDto) => {
    setModalSaving(true);
    setModalError(null);
    try {
      if (modal === "create") {
        await createUser(data as CreateUserRequestDto);
        flash(t("users.createOk"), true);
      } else if (editTarget) {
        await updateUser(editTarget.id, data as UpdateUserRequestDto);
        flash(t("users.updateOk"), true);
      }
      closeModal();
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setModalSaving(false);
    }
  }, [modal, editTarget, createUser, updateUser, t]);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (u: UserResponseDto) => {
    if (!window.confirm(t("users.deleteConfirm"))) return;
    setDeletingId(u.id);
    try {
      await deleteUser(u.id);
      flash(t("users.deleteOk"), true);
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : String(e), false);
    } finally {
      setDeletingId(null);
    }
  }, [deleteUser, t]);

  // ── Toggle individual permission ─────────────────────────────────────────────
  const handleTogglePermission = useCallback(async (u: UserResponseDto, permission: string) => {
    const current = u.extraPermissions ?? [];
    const next    = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    setSavingPermId(`${u.id}:${permission}`);
    try {
      const res  = await fetch(`/api/v1/users/${u.id}/permissions`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ permissions: next }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        flash(json.error ?? t("common.errorGeneric"), false);
        return;
      }
      // Optimistic update: reflect change without full reload
      u.extraPermissions = next;
      flash(t("users.permissionsUpdated"), true);
      await reload();
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : String(e), false);
    } finally {
      setSavingPermId(null);
    }
  }, [t, reload]);

  // ── FHIR Sync ───────────────────────────────────────────────────────────────
  const handleSync = useCallback(async (u: UserResponseDto) => {
    setSyncingId(u.id);
    try {
      const result = await syncToFhir(u.id);
      flash(result.synced ? t("users.syncOk") : (result.error ?? t("users.syncFailed")), result.synced);
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : String(e), false);
    } finally {
      setSyncingId(null);
    }
  }, [syncToFhir, t]);

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageFrom   = (page - 1) * pageSize + 1;
  const pageTo     = Math.min(page * pageSize, total);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />

      {modal && (
        <UserFormModal
          mode={modal}
          {...(editTarget !== null ? { initial: editTarget } : {})}
          catalog={roles}
          onSave={handleSave}
          onClose={closeModal}
          saving={modalSaving}
          error={modalError}
          t={t}
        />
      )}

      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[1200px] mx-auto">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary mb-4">
            <BackButton />
            <span className="text-zt-text-tertiary">|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("users.title")}</span>
          </nav>

          {/* Page header */}
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-[20px] font-medium text-zt-text-primary">{t("users.title")}</h1>
            <div className="flex items-center gap-2">
              {flashMsg && (
                <div className={`rounded border px-3 py-1.5 text-[12px] ${
                  flashMsg.ok
                    ? "border-zt-success-border bg-zt-success-light text-zt-success"
                    : "border-zt-danger-border bg-zt-danger-light text-zt-danger"
                }`}>
                  {flashMsg.text}
                </div>
              )}
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 text-[13px] px-3.5 py-[7px] rounded-lg bg-zt-primary text-zt-text-on-primary hover:bg-zt-primary/90 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {t("users.createBtn")}
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: t("users.statTotal"),       value: stats.total,       bg: "bg-zt-primary-light",  color: "text-zt-primary" },
              { label: t("users.statAdmins"),       value: stats.admins,      bg: "bg-zt-info-light",     color: "text-zt-info"    },
              { label: t("users.statPendingSync"),  value: stats.pendingSync, bg: "bg-zt-warning-bg",     color: "text-zt-warning-text" },
              { label: t("users.statErrors"),       value: stats.errors,      bg: "bg-zt-danger-light",   color: "text-zt-danger"  },
            ].map((s) => (
              <div key={s.label} className="bg-zt-bg-card border border-zt-border rounded-[10px] px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
                  <span className={`text-[16px] font-bold ${s.color}`}>{s.value}</span>
                </div>
                <span className="text-[12px] text-zt-text-secondary">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="relative flex-1 min-w-[200px] max-w-[320px]">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zt-text-tertiary pointer-events-none" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("users.searchPlaceholder")}
                className="w-full pl-8 pr-3 py-2 text-[13px] border border-zt-border rounded-lg bg-zt-bg-card text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-zt-bg-card border border-zt-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-zt-bg-page">
                  {[
                    t("users.colUsername"),
                    t("users.colRole"),
                    t("users.colProvider"),
                    t("users.colStatus"),
                    t("users.colFhirSync"),
                    t("users.colProfile"),
                    t("orders.date"),
                    t("orders.actions"),
                  ].map((h) => (
                    <th key={h} className="text-left text-[11px] font-medium text-zt-text-secondary uppercase tracking-[0.04em] px-4 py-2.5 border-b border-zt-border whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-b border-zt-border/50 last:border-0">
                    {Array.from({ length: 8 }, (__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-zt-bg-muted animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && error && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px] text-zt-danger">{error}</td></tr>
                )}

                {!loading && !error && users.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-[13px] text-zt-text-tertiary">{t("users.noResults")}</td></tr>
                )}

                {!loading && !error && users.map((u) => {
                  const isDeleting = deletingId === u.id;
                  const isSyncing  = syncingId  === u.id;
                  const displayName = [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ") || "—";
                  return (
                    <React.Fragment key={u.id}>
                    <tr className={`border-b border-zt-border/50 last:border-0 hover:bg-zt-bg-page transition-colors ${isDeleting ? "opacity-40" : ""}`}>
                      {/* Username */}
                      <td className="px-4 py-[11px] align-middle">
                        <div className="text-[13px] font-medium text-zt-text-primary">{u.username}</div>
                        {u.externalId && (
                          <div className="text-[11px] text-zt-text-tertiary font-mono truncate max-w-[160px]" title={u.externalId}>{u.externalId}</div>
                        )}
                      </td>
                      {/* Role */}
                      <td className="px-4 py-[11px] align-middle">
                        <Badge label={u.role === "admin" ? t("users.roleAdmin") : t("users.roleUser")} variant={roleVariant(u.role)} />
                      </td>
                      {/* Provider */}
                      <td className="px-4 py-[11px] align-middle text-[12px] text-zt-text-secondary capitalize">{u.providerType}</td>
                      {/* Status */}
                      <td className="px-4 py-[11px] align-middle">
                        <Badge label={statusLabel(u.status, t)} variant={statusVariant(u.status)} />
                      </td>
                      {/* FHIR Sync */}
                      <td className="px-4 py-[11px] align-middle">
                        <Badge
                          label={syncLabel(u.fhirSyncStatus, t)}
                          variant={syncVariant(u.fhirSyncStatus)}
                          icon={syncIcon(u.fhirSyncStatus)}
                          {...(() => {
                            const tip = u.fhirSyncError ?? (u.fhirSyncedAt ? `${t("users.syncedAt")}: ${formatDate(u.fhirSyncedAt)}` : undefined);
                            return tip !== undefined ? { tooltip: tip } : {};
                          })()}
                        />
                      </td>
                      {/* Profile */}
                      <td className="px-4 py-[11px] align-middle">
                        <div className="text-[13px] text-zt-text-primary">{displayName}</div>
                        {u.profile?.gln && (
                          <div className="text-[11px] text-zt-text-tertiary font-mono">GLN {u.profile.gln}</div>
                        )}
                      </td>
                      {/* Created */}
                      <td className="px-4 py-[11px] align-middle text-[12px] text-zt-text-secondary whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-[11px] align-middle">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleSync(u)}
                            disabled={isSyncing || isDeleting || !u.profile?.ptype}
                            title={!u.profile?.ptype ? t("users.syncNoPtype") : t("users.syncBtn")}
                            className="text-[11px] px-[9px] py-[3px] rounded-[6px] border border-zt-primary-border bg-zt-primary-light text-zt-primary hover:bg-zt-primary hover:text-zt-text-on-primary disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
                          >
                            {isSyncing ? "⏳" : "🔄"} FHIR
                          </button>
                          <button
                            onClick={() => openEdit(u)}
                            disabled={isDeleting}
                            className="text-[11px] px-[9px] py-[3px] rounded-[6px] border border-zt-border bg-zt-bg-card text-zt-text-primary hover:bg-zt-bg-page disabled:opacity-40 whitespace-nowrap transition-colors cursor-pointer"
                          >
                            {t("orders.edit")}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={isDeleting}
                            className="text-[11px] px-[9px] py-[3px] rounded-[6px] border border-zt-danger-border bg-zt-bg-card text-zt-danger hover:bg-zt-danger-light disabled:opacity-40 whitespace-nowrap transition-colors cursor-pointer"
                          >
                            {t("orders.delete")}
                          </button>
                          <button
                            onClick={() => togglePermissions(u.id)}
                            className={`text-[11px] px-[9px] py-[3px] rounded-[6px] border whitespace-nowrap transition-colors cursor-pointer ${
                              expandedId === u.id
                                ? "border-zt-primary bg-zt-primary text-zt-text-on-primary"
                                : "border-zt-border bg-zt-bg-card text-zt-text-secondary hover:bg-zt-bg-page"
                            }`}
                          >
                            {t("users.permissionsBtn")}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === u.id && (
                      <tr className="bg-zt-bg-muted/40 border-b border-zt-border/50">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="space-y-2">
                            {/* Role-based permissions — read only */}
                            <div>
                              <p className="text-[11px] text-zt-text-tertiary mb-1">{t("users.rolePermissions")}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from(ROLE_PERMISSION_MAP[u.role as "admin" | "user"] ?? [])
                                  .sort()
                                  .map((p) => (
                                    <code
                                      key={p}
                                      className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-zt-bg-card text-zt-text-secondary border border-zt-border"
                                    >
                                      {p}
                                    </code>
                                  ))}
                              </div>
                            </div>
                            {/* Assignable permissions — toggleable (admin only, and only for non-admin users) */}
                            {u.role !== "admin" && (
                              <div>
                                <p className="text-[11px] text-zt-text-tertiary mb-1">{t("users.extraPermissions")}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {ASSIGNABLE_PERMISSIONS.map((p) => {
                                    const granted   = (u.extraPermissions ?? []).includes(p);
                                    const isSaving  = savingPermId === `${u.id}:${p}`;
                                    return (
                                      <button
                                        key={p}
                                        disabled={isSaving}
                                        onClick={() => handleTogglePermission(u, p)}
                                        className={`px-2 py-0.5 rounded-md text-[11px] font-mono border transition-colors cursor-pointer disabled:opacity-50 ${
                                          granted
                                            ? "bg-zt-primary-light text-zt-primary border-zt-primary-border"
                                            : "bg-zt-bg-card text-zt-text-tertiary border-zt-border hover:border-zt-primary hover:text-zt-primary"
                                        }`}
                                      >
                                        {isSaving ? "…" : (granted ? "✓ " : "+ ")}{p}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Footer */}
            {!loading && !error && total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zt-border bg-zt-bg-page">
                <span className="text-[12px] text-zt-text-tertiary">
                  {t("orders.showingOf")
                    .replace("{from}", String(pageFrom))
                    .replace("{to}",   String(pageTo))
                    .replace("{total}", String(total))}
                </span>
                <div className="flex items-center gap-1">
                  {["«", "‹"].map((label, i) => (
                    <button key={label} onClick={() => setPage(i === 0 ? 1 : page - 1)} disabled={page <= 1}
                      className="w-7 h-7 rounded-[7px] border border-zt-border bg-zt-bg-card text-zt-text-secondary text-[12px] flex items-center justify-center hover:bg-zt-bg-page disabled:opacity-30 cursor-pointer disabled:cursor-default">
                      {label}
                    </button>
                  ))}
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const n = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    return (
                      <button key={n} onClick={() => setPage(n)}
                        className={`w-7 h-7 rounded-[7px] border text-[12px] flex items-center justify-center cursor-pointer transition-colors ${n === page ? "bg-zt-primary text-zt-text-on-primary border-zt-primary" : "border-zt-border bg-zt-bg-card text-zt-text-secondary hover:bg-zt-bg-page"}`}>
                        {n}
                      </button>
                    );
                  })}
                  {["›", "»"].map((label, i) => (
                    <button key={label} onClick={() => setPage(i === 0 ? page + 1 : totalPages)} disabled={page >= totalPages}
                      className="w-7 h-7 rounded-[7px] border border-zt-border bg-zt-bg-card text-zt-text-secondary text-[12px] flex items-center justify-center hover:bg-zt-bg-page disabled:opacity-30 cursor-pointer disabled:cursor-default">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
