"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { glnEnabled } from "@/config";

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

const PROFILE_FIELDS = [
  { key: "firstName",    labelKey: "profile.firstName",    half: true },
  { key: "lastName",     labelKey: "profile.lastName",     half: true },
  { key: "organization", labelKey: "profile.organization", half: false },
  { key: "localId",      labelKey: "profile.localId",      half: false },
  { key: "street",       labelKey: "profile.street",       half: true },
  { key: "streetNo",     labelKey: "profile.streetNo",     half: true },
  { key: "zip",          labelKey: "profile.zip",          half: true },
  { key: "city",         labelKey: "profile.city",         half: true },
  { key: "canton",       labelKey: "profile.canton",       half: true },
  { key: "country",      labelKey: "profile.country",      half: true },
  { key: "email",        labelKey: "profile.email",        half: true },
  { key: "phone",        labelKey: "profile.phone",        half: true },
] as const;

type FieldKey = typeof PROFILE_FIELDS[number]["key"];

export default function ProfilePage() {
  const { t } = useTranslation();

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<Record<FieldKey, string>>({
    firstName: "", lastName: "", organization: "", localId: "",
    street: "", streetNo: "", zip: "", city: "",
    canton: "", country: "", email: "", phone: "",
  });

  // Own GLN state
  const [glnInput, setGlnInput] = useState("");
  const [glnPtype, setGlnPtype] = useState("");
  const [glnRoleType, setGlnRoleType] = useState("");
  const [glnMsg, setGlnMsg] = useState<string | null>(null);
  const [glnErr, setGlnErr] = useState<string | null>(null);
  const [glnLoading, setGlnLoading] = useState(false);

  // Linked organisation GLN state (second GLN)
  const [orgGlnInput, setOrgGlnInput] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgFhirId, setOrgFhirId] = useState("");
  const [orgGlnMsg, setOrgGlnMsg] = useState<string | null>(null);
  const [orgGlnErr, setOrgGlnErr] = useState<string | null>(null);
  const [orgGlnLoading, setOrgGlnLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const saveMsgTimer = useRef<number | undefined>(undefined);

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
        if (p.gln)      setGlnInput(p.gln);
        if (p.ptype)    setGlnPtype(p.ptype);
        if (p.roleType) setGlnRoleType(p.roleType);
        if (p.orgGln)   setOrgGlnInput(p.orgGln);
        if (p.orgName)  setOrgName(p.orgName);
        if (p.orgFhirId) setOrgFhirId(p.orgFhirId);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // ── Own GLN lookup ──────────────────────────────────────────────────────
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
        const key = json.error === "noGlnApi"    ? "profile.noGlnApi"
                  : json.error === "glnNotFound" ? "profile.glnNotFound"
                  : json.error === "invalidGln"  ? "profile.invalidGln"
                  : null;
        throw new Error(key ? t(key) : (json.error || `HTTP ${res.status}`));
      }
      const ptype = json.ptype || "";
      setGlnPtype(ptype);
      setGlnRoleType(json.roleType || "");
      const isNATLocal = ptype === "NAT";
      setFields((prev) => ({
        ...prev,
        firstName:    isNATLocal ? (json.firstName    || prev.firstName)    : "",
        lastName:     isNATLocal ? (json.lastName     || prev.lastName)     : "",
        organization: isNATLocal ? "" : (json.organization || prev.organization),
        ...(json.street   && { street:   json.street }),
        ...(json.streetNo && { streetNo: json.streetNo }),
        ...(json.zip      && { zip:      json.zip }),
        ...(json.city     && { city:     json.city }),
        ...(json.canton   && { canton:   json.canton }),
        ...(json.country  && { country:  json.country }),
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

  // ── Linked organisation GLN lookup ──────────────────────────────────────
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
        const key = json.error === "noGlnApi"    ? "profile.noGlnApi"
                  : json.error === "glnNotFound" ? "profile.glnNotFound"
                  : json.error === "invalidGln"  ? "profile.invalidGln"
                  : null;
        throw new Error(key ? t(key) : (json.error || `HTTP ${res.status}`));
      }
      const name = json.organization || [json.lastName, json.firstName].filter(Boolean).join(", ") || gln;
      setOrgName(name);
      setOrgFhirId(""); // will be resolved server-side on save
      setOrgGlnMsg(`${t("profile.glnFound")}: ${name}`);
    } catch (e: unknown) {
      setOrgGlnErr(e instanceof Error ? e.message : String(e));
    } finally {
      setOrgGlnLoading(false);
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────
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
          gln:      gln    || undefined,
          localId:  fields.localId || undefined,
          ptype:    glnPtype    || undefined,
          roleType: glnRoleType || undefined,
          orgGln:   orgGln  || undefined,
          orgName:  orgName || undefined,
          orgFhirId: orgFhirId || undefined,
          // Enforce: JUR must not send person fields, NAT must not send org field
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

  const formatDate = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  };

  const showOrgGlnBlock = !!glnPtype; // show for both NAT and JUR once own GLN is known
  const orgGlnLabel = glnPtype === "NAT"
    ? t("profile.orgGlnNat")   // "Zugehörige Organisation (GLN)"
    : t("profile.orgGlnJur");  // "Übergeordnete Organisation (GLN)"

  if (loading) return <div className="p-8 text-gray-500">{t("common.loading")}</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-600">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="text-blue-600 hover:underline">🏠 {t("nav.home")}</Link></li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-700">{t("profile.title")}</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold mb-6">{t("profile.title")}</h1>

      {/* Account info */}
      <div className="rounded border bg-white p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t("profile.account")}</h2>
        <dl className="divide-y divide-gray-100">
          <div className="py-2 grid grid-cols-3 gap-4">
            <dt className="text-sm text-gray-500">{t("profile.username")}</dt>
            <dd className="text-sm text-gray-900 col-span-2 font-mono">{user?.username ?? "—"}</dd>
          </div>
          <div className="py-2 grid grid-cols-3 gap-4">
            <dt className="text-sm text-gray-500">{t("profile.membersince")}</dt>
            <dd className="text-sm text-gray-900 col-span-2">{formatDate(user?.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {/* Own GLN */}
      <div className="rounded border bg-white p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t("profile.gln")}</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">{t("profile.glnNumber")}</label>
            <input
              type="text"
              value={glnInput}
              onChange={(e) => setGlnInput(e.target.value.replace(/\D/g, "").slice(0, 13))}
              placeholder={t("profile.glnPlaceholder")}
              maxLength={13}
              className="w-full rounded border px-3 py-2 text-sm text-gray-700 font-mono tracking-widest"
            />
          </div>
          {glnEnabled ? (
            <button
              type="button"
              onClick={lookupGln}
              disabled={glnLoading || glnInput.replace(/\D/g, "").length !== 13}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:bg-blue-300 whitespace-nowrap"
            >
              {glnLoading ? t("common.searching") : t("profile.glnLookup")}
            </button>
          ) : (
            <div className="text-xs text-gray-400 italic">{t("profile.noGlnApi")}</div>
          )}
        </div>
        {glnPtype && (
          <div className="mt-2 text-xs text-gray-500">
            {glnPtype === "NAT" ? "👤 Natürliche Person (NAT)" : "🏢 Juristische Person / Organisation (JUR)"}
            {glnRoleType && ` · Rolle: ${glnRoleType}`}
          </div>
        )}
        {glnMsg && <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">{glnMsg}</div>}
        {glnErr && <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">{glnErr}</div>}
      </div>

      {/* Linked organisation GLN — shown for both NAT and JUR once own GLN resolved */}
      {showOrgGlnBlock && (
        <div className="rounded border bg-white p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {orgGlnLabel}
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            {glnPtype === "NAT"
              ? t("profile.orgGlnNatHint")
              : t("profile.orgGlnJurHint")}
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">{t("profile.glnNumber")}</label>
              <input
                type="text"
                value={orgGlnInput}
                onChange={(e) => setOrgGlnInput(e.target.value.replace(/\D/g, "").slice(0, 13))}
                placeholder={t("profile.glnPlaceholder")}
                maxLength={13}
                className="w-full rounded border px-3 py-2 text-sm text-gray-700 font-mono tracking-widest"
              />
            </div>
            {glnEnabled ? (
              <button
                type="button"
                onClick={lookupOrgGln}
                disabled={orgGlnLoading || orgGlnInput.replace(/\D/g, "").length !== 13}
                className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:bg-blue-300 whitespace-nowrap"
              >
                {orgGlnLoading ? t("common.searching") : t("profile.glnLookup")}
              </button>
            ) : (
              <div className="text-xs text-gray-400 italic">{t("profile.noGlnApi")}</div>
            )}
          </div>
          {orgName && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">{glnPtype === "NAT" ? "🏢" : "🏛️"}</span>
              <span className="text-sm font-medium text-gray-800">{orgName}</span>
            </div>
          )}
          {orgGlnMsg && <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">{orgGlnMsg}</div>}
          {orgGlnErr && <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">{orgGlnErr}</div>}
        </div>
      )}

      {/* Profile form */}
      <div className="rounded border bg-white p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{t("profile.details")}</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {PROFILE_FIELDS.map(({ key, labelKey, half }) => {
            const isPersonField = key === "firstName" || key === "lastName";
            const isOrgField    = key === "organization";
            if (glnPtype === "JUR" && isPersonField) return null;
            if (glnPtype === "NAT" && isOrgField)    return null;
            return (
              <div key={key} className={half ? "" : "col-span-2"}>
                <label className="block text-xs text-gray-500 mb-1">{t(labelKey)}</label>
                <input
                  type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                  value={fields[key]}
                  onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full rounded border px-3 py-2 text-sm text-gray-700"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={saveProfile}
          disabled={saving}
          className="px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
        {saveMsg && <span className="text-sm text-green-700">{saveMsg}</span>}
        {saveErr && <span className="text-sm text-red-600">{saveErr}</span>}
      </div>
    </div>
  );
}
