"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { glnEnabled } from "@/config";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { useMyPermissions } from "@/presentation/hooks/useMyPermissions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Profile = {
  gln?: string;
  localId?: string;
  ptype?: string;
  roleType?: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  street?: string;
  streetNo?: string;
  zip?: string;
  city?: string;
  canton?: string;
  country?: string;
  email?: string;
  phone?: string;
  orgGln?: string;
  orgName?: string;
  orgFhirId?: string;
};

type UserData = {
  id: string;
  username: string;
  createdAt: string;
  profile: Profile;
};

// ── Field definitions ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PROFILE_FIELDS = [
  { key: "firstName",    labelKey: "profile.firstName",    layout: "half" },
  { key: "lastName",     labelKey: "profile.lastName",     layout: "half" },
  { key: "organization", labelKey: "profile.organization", layout: "full" },
  { key: "localId",      labelKey: "profile.localId",      layout: "full" },
  { key: "street",       labelKey: "profile.street",       layout: "two-thirds" },
  { key: "streetNo",     labelKey: "profile.streetNo",     layout: "third" },
  { key: "zip",          labelKey: "profile.zip",          layout: "third" },
  { key: "city",         labelKey: "profile.city",         layout: "half" },
  { key: "canton",       labelKey: "profile.canton",       layout: "half" },
  { key: "country",      labelKey: "profile.country",      layout: "half" },
  { key: "email",        labelKey: "profile.email",        layout: "half" },
  { key: "phone",        labelKey: "profile.phone",        layout: "half" },
] as const;

type FieldKey = typeof PROFILE_FIELDS[number]["key"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(username: string): string {
  const parts = username.trim().split(/[\s._-]+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zt-bg-card border border-zt-border rounded-xl mb-4 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-zt-border">
        <span className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-[0.05em]">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
  hintOk,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  hintOk?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-zt-text-secondary">{label}</label>
      {children}
      {hint && (
        <span className={`text-[11px] ${hintOk ? "text-zt-success" : "text-zt-warning-text"}`}>{hint}</span>
      )}
    </div>
  );
}

function TextInput({
  type = "text",
  value,
  onChange,
  placeholder,
  maxLength,
  mono,
  disabled,
}: {
  type?: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  mono?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      readOnly={!onChange}
      className={[
        "px-3 py-2 text-[13px] border border-zt-border rounded-lg outline-none",
        "bg-zt-bg-page text-zt-text-primary placeholder:text-zt-text-tertiary",
        "focus:border-zt-primary focus:ring-2 focus:ring-zt-primary/10 focus:bg-zt-bg-card",
        disabled ? "bg-zt-bg-muted text-zt-text-tertiary cursor-not-allowed" : "",
        !onChange && !disabled ? "bg-zt-bg-muted text-zt-text-secondary" : "",
        mono ? "font-mono tracking-widest" : "",
      ].join(" ")}
    />
  );
}

// ── ProfilePage ───────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t } = useTranslation();
  const { data: myPerms, loading: permsLoading } = useMyPermissions();

  const [user, setUser]     = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<Record<FieldKey, string>>({
    firstName: "", lastName: "", organization: "", localId: "",
    street: "", streetNo: "", zip: "", city: "",
    canton: "", country: "", email: "", phone: "",
  });

  // Own GLN
  const [glnInput,    setGlnInput]    = useState("");
  const [glnPtype,    setGlnPtype]    = useState("");
  const [glnRoleType, setGlnRoleType] = useState("");
  const [glnMsg,      setGlnMsg]      = useState<string | null>(null);
  const [glnErr,      setGlnErr]      = useState<string | null>(null);
  const [glnLoading,  setGlnLoading]  = useState(false);

  // Org GLN
  const [orgGlnInput,   setOrgGlnInput]   = useState("");
  const [orgName,       setOrgName]       = useState("");
  const [orgFhirId,     setOrgFhirId]     = useState("");
  const [orgGlnMsg,     setOrgGlnMsg]     = useState<string | null>(null);
  const [orgGlnErr,     setOrgGlnErr]     = useState<string | null>(null);
  const [orgGlnLoading, setOrgGlnLoading] = useState(false);

  // Save
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const saveMsgTimer = useRef<number | undefined>(undefined);

  // Password (UI only — no existing backend endpoint)
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/me/profile", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) { window.location.href = "/login"; return; }
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as UserData;
        setUser(data);
        const p = data.profile || {};
        setFields({
          firstName:    p.firstName    ?? "",
          lastName:     p.lastName     ?? "",
          organization: p.organization ?? "",
          localId:      p.localId      ?? "",
          street:       p.street       ?? "",
          streetNo:     p.streetNo     ?? "",
          zip:          p.zip          ?? "",
          city:         p.city         ?? "",
          canton:       p.canton       ?? "",
          country:      p.country      ?? "",
          email:        p.email        ?? "",
          phone:        p.phone        ?? "",
        });
        if (p.gln)       setGlnInput(p.gln);
        if (p.ptype)     setGlnPtype(p.ptype);
        if (p.roleType)  setGlnRoleType(p.roleType);
        if (p.orgGln)    setOrgGlnInput(p.orgGln);
        if (p.orgName)   setOrgName(p.orgName);
        if (p.orgFhirId) setOrgFhirId(p.orgFhirId);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // ── Own GLN lookup ────────────────────────────────────────────────────────
  async function lookupGln() {
    const gln = glnInput.trim().replace(/\D/g, "");
    if (gln.length !== 13) return;
    setGlnLoading(true);
    setGlnMsg(null);
    setGlnErr(null);
    try {
      const res = await fetch(`/api/gln-lookup?gln=${encodeURIComponent(gln)}`);
      let json: Record<string, string>;
      try { json = await res.json(); }
      catch { throw new Error(`HTTP ${res.status} – ungültige Antwort`); }
      if (!res.ok) {
        const key = json.error === "glnNotFound"    ? "profile.glnNotFound"
                  : json.error === "invalidGln"      ? "profile.invalidGln"
                  : json.error === "glnUnavailable"  ? "profile.glnUnavailable"
                  : json.error === "glnError"         ? "profile.glnUnavailable"
                  : json.error === "noGlnApi"         ? "profile.noGlnApi"
                  : null;
        throw new Error(key ? t(key) : `HTTP ${res.status}`);
      }
      const ptype = json.ptype || "";
      setGlnPtype(ptype);
      setGlnRoleType("");
      const isNATLocal = ptype === "NAT";
      setFields((prev) => ({
        ...prev,
        firstName:    isNATLocal ? (json.firstName    || prev.firstName)    : "",
        lastName:     isNATLocal ? (json.lastName     || prev.lastName)     : "",
        organization: isNATLocal ? "" : (json.organization || prev.organization),
      }));
      const label = isNATLocal
        ? [json.lastName, json.firstName].filter(Boolean).join(", ")
        : (json.organization || gln);
      setGlnMsg(`${t("profile.glnFound")}: ${label}`);
    } catch (e: unknown) {
      setGlnErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGlnLoading(false);
    }
  }

  // ── Org GLN lookup ────────────────────────────────────────────────────────
  async function lookupOrgGln() {
    const gln = orgGlnInput.trim().replace(/\D/g, "");
    if (gln.length !== 13) return;
    setOrgGlnLoading(true);
    setOrgGlnMsg(null);
    setOrgGlnErr(null);
    try {
      const res = await fetch(`/api/gln-lookup?gln=${encodeURIComponent(gln)}`);
      let json: Record<string, string>;
      try { json = await res.json(); }
      catch { throw new Error(`HTTP ${res.status} – ungültige Antwort`); }
      if (!res.ok) {
        const key = json.error === "glnNotFound"    ? "profile.glnNotFound"
                  : json.error === "invalidGln"      ? "profile.invalidGln"
                  : json.error === "glnUnavailable"  ? "profile.glnUnavailable"
                  : json.error === "glnError"         ? "profile.glnUnavailable"
                  : json.error === "noGlnApi"         ? "profile.noGlnApi"
                  : null;
        throw new Error(key ? t(key) : `HTTP ${res.status}`);
      }
      const name = json.organization || [json.lastName, json.firstName].filter(Boolean).join(", ") || gln;
      setOrgName(name);
      setOrgFhirId("");
      setOrgGlnMsg(`${t("profile.glnFound")}: ${name}`);
    } catch (e: unknown) {
      setOrgGlnErr(e instanceof Error ? e.message : String(e));
    } finally {
      setOrgGlnLoading(false);
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function saveProfile() {
    const gln    = glnInput.trim().replace(/\D/g, "");
    const orgGln = orgGlnInput.trim().replace(/\D/g, "");
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    window.clearTimeout(saveMsgTimer.current);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...fields,
          gln:      gln      || undefined,
          localId:  fields.localId || undefined,
          ptype:    glnPtype    || undefined,
          roleType: glnRoleType || undefined,
          orgGln:   orgGln   || undefined,
          orgName:  orgName  || undefined,
          orgFhirId: orgFhirId || undefined,
          firstName:    glnPtype === "JUR" ? undefined : (fields.firstName  || undefined),
          lastName:     glnPtype === "JUR" ? undefined : (fields.lastName   || undefined),
          organization: glnPtype === "NAT" ? undefined : (fields.organization || undefined),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || String(res.status));
      if (user) setUser({ ...user, profile: json.profile });
      setSaveMsg(t("profile.saved"));
      saveMsgTimer.current = window.setTimeout(() => setSaveMsg(null), 3000);
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    const p = user?.profile || {};
    setFields({
      firstName:    p.firstName    ?? "",
      lastName:     p.lastName     ?? "",
      organization: p.organization ?? "",
      localId:      p.localId      ?? "",
      street:       p.street       ?? "",
      streetNo:     p.streetNo     ?? "",
      zip:          p.zip          ?? "",
      city:         p.city         ?? "",
      canton:       p.canton       ?? "",
      country:      p.country      ?? "",
      email:        p.email        ?? "",
      phone:        p.phone        ?? "",
    });
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
  }

  // ── Copy user ID ──────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const handleCopyId = useCallback(() => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  }, [user?.id]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const showOrgGlnBlock = !!glnPtype;
  const orgGlnLabel = glnPtype === "NAT" ? t("profile.orgGlnNat") : t("profile.orgGlnJur");
  const displayName = user
    ? [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ") || user.username
    : "";
  const avatarText = user ? initials(user.username) : "?";
  const hasGln = !!glnInput.trim();

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-1 min-h-0">
        <AppSidebar />
        <div className="flex-1 flex items-center justify-center bg-zt-bg-page">
          <div className="h-5 w-32 rounded bg-zt-bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />

      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[860px]">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary mb-4" aria-label="Brotkrumen">
            <BackButton />
            <span className="text-zt-text-tertiary">|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("profile.title")}</span>
          </nav>

          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-[20px] font-medium text-zt-text-primary">{t("profile.title")}</h1>
          </div>

          {/* Profile hero */}
          <div className="bg-zt-bg-card border border-zt-border rounded-xl px-6 py-5 mb-5 flex items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full bg-zt-primary flex items-center justify-center text-[22px] font-medium text-zt-text-on-primary select-none">
                {avatarText}
              </div>
              <button
                type="button"
                className="absolute bottom-0 right-0 w-5 h-5 bg-zt-bg-card border border-zt-border rounded-full flex items-center justify-center cursor-pointer hover:bg-zt-bg-page"
                aria-label="Avatar bearbeiten"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M6.5 1.5l2 2L3 9H1V7L6.5 1.5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" className="text-zt-text-secondary" fill="none"/>
                </svg>
              </button>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="text-[18px] font-medium text-zt-text-primary leading-tight">
                {displayName || user?.username || "—"}
              </div>
              <div className="text-[13px] text-zt-text-secondary mt-0.5">@{user?.username}</div>
              {user?.createdAt && (
                <div className="text-[12px] text-zt-text-tertiary mt-1">
                  {t("profile.membersince")} {formatDate(user.createdAt)}
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {glnRoleType && (
                  <span className="text-[11px] px-[9px] py-[3px] rounded-full bg-zt-primary-light text-zt-primary border border-zt-primary-border">
                    {glnRoleType}
                  </span>
                )}
                <span className={`text-[11px] px-[9px] py-[3px] rounded-full border ${
                  hasGln
                    ? "bg-zt-success-light text-zt-success border-zt-success-border"
                    : "bg-zt-warning-bg text-zt-warning-text border-zt-warning-border"
                }`}>
                  {hasGln ? `GLN ${glnInput}` : t("profile.glnNotConfigured")}
                </span>
              </div>
            </div>
          </div>

          {/* Account info (read-only) */}
          <SectionCard title={t("profile.account")}>
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <div className="flex justify-between items-center py-2.5 border-b border-zt-border/50">
                  <span className="text-[13px] text-zt-text-secondary">{t("profile.username")}</span>
                  <span className="text-[13px] font-medium text-zt-text-primary font-mono">{user?.username ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-zt-border/50">
                  <span className="text-[13px] text-zt-text-secondary">{t("profile.membersince")}</span>
                  <span className="text-[13px] font-medium text-zt-text-primary">{formatDate(user?.createdAt)}</span>
                </div>
                {/* User ID — read-only, copy-to-clipboard */}
                <div className="flex justify-between items-center py-2.5 gap-3">
                  <span className="text-[13px] text-zt-text-secondary shrink-0">{t("profile.userId")}</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-mono text-zt-text-tertiary truncate" title={user?.id ?? ""}>
                      {user?.id ?? "—"}
                    </span>
                    {user?.id && (
                      <button
                        type="button"
                        onClick={handleCopyId}
                        title={copied ? t("profile.copied") : t("profile.copyId")}
                        className="shrink-0 p-1 rounded hover:bg-zt-bg-muted transition-colors text-zt-text-tertiary hover:text-zt-primary"
                        aria-label={t("profile.copyId")}
                      >
                        {copied ? (
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                            <path d="M2 7l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zt-success"/>
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                            <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1"/>
                            <path d="M3 9H2a1 1 0 01-1-1V2a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                {glnRoleType && (
                  <div className="flex justify-between items-center py-2.5 border-b border-zt-border/50">
                    <span className="text-[13px] text-zt-text-secondary">{t("profile.role")}</span>
                    <span className="text-[13px] font-medium text-zt-text-primary">{glnRoleType}</span>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Own GLN */}
          <SectionCard title={t("profile.gln")}>
            <div className="max-w-[420px]">
              <Field label={t("profile.glnNumber")}>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={glnInput}
                    onChange={(e) => setGlnInput(e.target.value.replace(/\D/g, "").slice(0, 13))}
                    placeholder={t("profile.glnPlaceholder")}
                    maxLength={13}
                    className="flex-1 px-3 py-2 text-[13px] border border-zt-border rounded-lg bg-zt-bg-page text-zt-text-primary font-mono tracking-widest placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary focus:ring-2 focus:ring-zt-primary/10"
                  />
                  {glnEnabled ? (
                    <button
                      type="button"
                      onClick={lookupGln}
                      disabled={glnLoading || glnInput.replace(/\D/g, "").length !== 13}
                      className="text-[12px] px-3 py-2 rounded-lg bg-zt-primary-light border border-zt-primary-border text-zt-primary hover:bg-zt-primary hover:text-zt-text-on-primary disabled:opacity-40 whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      {glnLoading ? t("common.searching") : t("profile.glnLookup")}
                    </button>
                  ) : (
                    <span className="text-[12px] px-3 py-[5px] rounded-lg bg-zt-warning-bg border border-zt-warning-border text-zt-warning-text whitespace-nowrap">
                      {t("profile.noGlnApi")}
                    </span>
                  )}
                </div>
              </Field>
              {glnPtype && (
                <div className="mt-2 text-[12px] text-zt-text-secondary">
                  {glnPtype === "NAT" ? "👤 Natürliche Person (NAT)" : "🏢 Juristische Person / Organisation (JUR)"}
                  {glnRoleType && ` · Rolle: ${glnRoleType}`}
                </div>
              )}
              {glnMsg && (
                <div className="mt-2 text-[12px] text-zt-success bg-zt-success-light border border-zt-success-border px-3 py-1.5 rounded-lg">
                  {glnMsg}
                </div>
              )}
              {glnErr && (
                <div className="mt-2 text-[12px] text-zt-danger bg-zt-danger-light border border-zt-danger-border px-3 py-1.5 rounded-lg">
                  {glnErr}
                </div>
              )}
            </div>
          </SectionCard>

          {/* Linked org GLN */}
          {showOrgGlnBlock && (
            <SectionCard title={orgGlnLabel}>
              <p className="text-[12px] text-zt-text-tertiary mb-4">
                {glnPtype === "NAT" ? t("profile.orgGlnNatHint") : t("profile.orgGlnJurHint")}
              </p>
              <div className="max-w-[420px]">
                <Field label={t("profile.glnNumber")}>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={orgGlnInput}
                      onChange={(e) => setOrgGlnInput(e.target.value.replace(/\D/g, "").slice(0, 13))}
                      placeholder={t("profile.glnPlaceholder")}
                      maxLength={13}
                      className="flex-1 px-3 py-2 text-[13px] border border-zt-border rounded-lg bg-zt-bg-page text-zt-text-primary font-mono tracking-widest placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary focus:ring-2 focus:ring-zt-primary/10"
                    />
                    {glnEnabled ? (
                      <button
                        type="button"
                        onClick={lookupOrgGln}
                        disabled={orgGlnLoading || orgGlnInput.replace(/\D/g, "").length !== 13}
                        className="text-[12px] px-3 py-2 rounded-lg bg-zt-primary-light border border-zt-primary-border text-zt-primary hover:bg-zt-primary hover:text-zt-text-on-primary disabled:opacity-40 whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        {orgGlnLoading ? t("common.searching") : t("profile.glnLookup")}
                      </button>
                    ) : (
                      <span className="text-[12px] px-3 py-[5px] rounded-lg bg-zt-warning-bg border border-zt-warning-border text-zt-warning-text whitespace-nowrap">
                        {t("profile.noGlnApi")}
                      </span>
                    )}
                  </div>
                </Field>
                {orgName && (
                  <div className="mt-2 flex items-center gap-2 text-[13px] text-zt-text-primary">
                    <span>{glnPtype === "NAT" ? "🏢" : "🏛️"}</span>
                    <span className="font-medium">{orgName}</span>
                  </div>
                )}
                {orgGlnMsg && (
                  <div className="mt-2 text-[12px] text-zt-success bg-zt-success-light border border-zt-success-border px-3 py-1.5 rounded-lg">
                    {orgGlnMsg}
                  </div>
                )}
                {orgGlnErr && (
                  <div className="mt-2 text-[12px] text-zt-danger bg-zt-danger-light border border-zt-danger-border px-3 py-1.5 rounded-lg">
                    {orgGlnErr}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Profile details */}
          <SectionCard title={t("profile.details")}>
            {/* firstName + lastName */}
            {(glnPtype !== "JUR") && (
              <div className="grid grid-cols-2 gap-3.5 mb-3.5">
                <Field label={t("profile.firstName")}>
                  <TextInput
                    value={fields.firstName}
                    onChange={(v) => setFields((p) => ({ ...p, firstName: v }))}
                    placeholder="Farhad"
                  />
                </Field>
                <Field label={t("profile.lastName")}>
                  <TextInput
                    value={fields.lastName}
                    onChange={(v) => setFields((p) => ({ ...p, lastName: v }))}
                    placeholder="Arian"
                  />
                </Field>
              </div>
            )}
            {/* organization */}
            {(glnPtype !== "NAT") && (
              <div className="mb-3.5">
                <Field label={t("profile.organization")}>
                  <TextInput
                    value={fields.organization}
                    onChange={(v) => setFields((p) => ({ ...p, organization: v }))}
                    placeholder="z.B. Praxis Musterarzt AG"
                  />
                </Field>
              </div>
            )}
            {/* localId */}
            <div className="mb-3.5">
              <Field label={t("profile.localId")}>
                <TextInput
                  value={fields.localId}
                  onChange={(v) => setFields((p) => ({ ...p, localId: v }))}
                  placeholder="z.B. X000000"
                />
              </Field>
            </div>

            <div className="h-px bg-zt-border/50 mb-3.5" />

            {/* street + streetNo + zip */}
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-3.5 mb-3.5">
              <Field label={t("profile.street")}>
                <TextInput
                  value={fields.street}
                  onChange={(v) => setFields((p) => ({ ...p, street: v }))}
                  placeholder="Musterstrasse"
                />
              </Field>
              <Field label={t("profile.streetNo")}>
                <TextInput
                  value={fields.streetNo}
                  onChange={(v) => setFields((p) => ({ ...p, streetNo: v }))}
                  placeholder="1"
                />
              </Field>
              <Field label={t("profile.zip")}>
                <TextInput
                  value={fields.zip}
                  onChange={(v) => setFields((p) => ({ ...p, zip: v }))}
                  placeholder="8001"
                />
              </Field>
            </div>

            {/* city + canton */}
            <div className="grid grid-cols-2 gap-3.5 mb-3.5">
              <Field label={t("profile.city")}>
                <TextInput
                  value={fields.city}
                  onChange={(v) => setFields((p) => ({ ...p, city: v }))}
                  placeholder="Zürich"
                />
              </Field>
              <Field label={t("profile.canton")}>
                <TextInput
                  value={fields.canton}
                  onChange={(v) => setFields((p) => ({ ...p, canton: v }))}
                  placeholder="ZH"
                />
              </Field>
            </div>

            {/* country */}
            <div className="grid grid-cols-2 gap-3.5 mb-3.5">
              <Field label={t("profile.country")}>
                <TextInput
                  value={fields.country}
                  onChange={(v) => setFields((p) => ({ ...p, country: v }))}
                  placeholder="Schweiz"
                />
              </Field>
            </div>

            <div className="h-px bg-zt-border/50 mb-3.5" />

            {/* email + phone */}
            <div className="grid grid-cols-2 gap-3.5">
              <Field label={t("profile.email")}>
                <TextInput
                  type="email"
                  value={fields.email}
                  onChange={(v) => setFields((p) => ({ ...p, email: v }))}
                  placeholder="name@praxis.ch"
                />
              </Field>
              <Field label={t("profile.phone")}>
                <TextInput
                  type="tel"
                  value={fields.phone}
                  onChange={(v) => setFields((p) => ({ ...p, phone: v }))}
                  placeholder="+41 44 000 00 00"
                />
              </Field>
            </div>
          </SectionCard>

          {/* Password */}
          <SectionCard title={t("profile.changePassword")}>
            <div className="grid grid-cols-3 gap-3.5">
              <Field label={t("profile.currentPassword")}>
                <TextInput
                  type="password"
                  value={currentPwd}
                  onChange={setCurrentPwd}
                  placeholder="••••••••"
                />
              </Field>
              <Field label={t("profile.newPassword")}>
                <TextInput
                  type="password"
                  value={newPwd}
                  onChange={setNewPwd}
                  placeholder="••••••••"
                />
              </Field>
              <Field label={t("profile.confirmPassword")}>
                <TextInput
                  type="password"
                  value={confirmPwd}
                  onChange={setConfirmPwd}
                  placeholder="••••••••"
                />
              </Field>
            </div>
          </SectionCard>

          {/* Meine Berechtigungen (read-only) */}
          <SectionCard title={t("profile.permissions")}>
            {permsLoading ? (
              <div className="flex gap-2 animate-pulse">
                {[80, 96, 72, 88].map((w) => (
                  <div key={w} className="h-5 rounded-full bg-zt-bg-muted" style={{ width: w }} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Role badge */}
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-zt-text-secondary">{t("profile.permissionsRole")}:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    myPerms?.role === "admin"
                      ? "bg-zt-info-light text-zt-info border border-zt-info-border"
                      : "bg-zt-bg-muted text-zt-text-secondary border border-zt-border"
                  }`}>
                    {myPerms?.role ?? "—"}
                  </span>
                </div>
                {/* Permissions list */}
                <div>
                  <p className="text-[11px] text-zt-text-tertiary mb-2">{t("profile.permissionsGranted")}:</p>
                  {(myPerms?.permissions.length ?? 0) === 0 ? (
                    <p className="text-[12px] text-zt-text-tertiary">{t("profile.permissionsNone")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {myPerms!.permissions.map((p) => (
                        <code
                          key={p}
                          className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-zt-primary-light text-zt-primary border border-zt-primary-border"
                        >
                          {p}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Save bar */}
          <div className="bg-zt-bg-card border border-zt-border rounded-xl px-5 py-3.5 flex items-center justify-between mt-1">
            <div className="flex items-center gap-2 text-[12px] text-zt-text-tertiary">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1"/>
                <path d="M6.5 5.5v4M6.5 4h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {t("profile.unsavedHint")}
              {saveMsg && <span className="text-zt-success font-medium">{saveMsg}</span>}
              {saveErr && <span className="text-zt-danger font-medium">{saveErr}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={discardChanges}
                className="text-[13px] px-[18px] py-2 rounded-lg border border-zt-danger-border bg-zt-bg-card text-zt-danger hover:bg-zt-danger-light transition-colors cursor-pointer"
              >
                {t("profile.discardChanges")}
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="text-[13px] px-[18px] py-2 rounded-lg bg-zt-primary text-zt-text-on-primary font-medium hover:bg-zt-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? t("common.saving") : t("profile.saveProfile")}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
