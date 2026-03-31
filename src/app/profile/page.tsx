"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { glnEnabled } from "@/config";

type Profile = {
  gln?: string;
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
    firstName: "", lastName: "", organization: "",
    street: "", streetNo: "", zip: "", city: "",
    canton: "", country: "", email: "", phone: "",
  });
  const [glnInput, setGlnInput] = useState("");
  const [glnMsg, setGlnMsg] = useState<string | null>(null);
  const [glnErr, setGlnErr] = useState<string | null>(null);
  const [glnLoading, setGlnLoading] = useState(false);

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
          street:       p.street       ?? "",
          streetNo:     p.streetNo     ?? "",
          zip:          p.zip          ?? "",
          city:         p.city         ?? "",
          canton:       p.canton       ?? "",
          country:      p.country      ?? "",
          email:        p.email        ?? "",
          phone:        p.phone        ?? "",
        });
        if (p.gln) setGlnInput(p.gln);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function lookupGln() {
    const gln = glnInput.trim().replace(/\D/g, "");
    if (gln.length !== 13) return;
    setGlnLoading(true);
    setGlnMsg(null);
    setGlnErr(null);
    try {
      const res = await fetch(`/api/gln-lookup?gln=${encodeURIComponent(gln)}`);
      const json = await res.json();
      if (!res.ok) {
        const key = json.error === "noGlnApi"   ? "profile.noGlnApi"
                  : json.error === "glnNotFound" ? "profile.glnNotFound"
                  : json.error === "invalidGln"  ? "profile.invalidGln"
                  : null;
        throw new Error(key ? t(key) : (json.error || String(res.status)));
      }
      setFields((prev) => ({
        ...prev,
        organization: json.organization || prev.organization,
        street:       json.street       || prev.street,
        streetNo:     json.streetNo     || prev.streetNo,
        zip:          json.zip          || prev.zip,
        city:         json.city         || prev.city,
        canton:       json.canton       || prev.canton,
        country:      json.country      || prev.country,
      }));
      setFields((prev) => ({ ...prev })); // trigger re-render
      // Also persist GLN in fields via save
      setGlnMsg(`${t("profile.glnFound")}: ${json.organization || gln}`);
    } catch (e: unknown) {
      setGlnErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGlnLoading(false);
    }
  }

  async function saveProfile() {
    const gln = glnInput.trim().replace(/\D/g, "");
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    window.clearTimeout(saveMsgTimer.current);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...fields, gln: gln || undefined }),
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

  if (loading) {
    return (
      <div className="p-8 text-gray-500">{t("common.loading")}</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-600">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="text-blue-600 hover:underline">{t("nav.home")}</Link></li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-700">{t("profile.title")}</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold mb-6">{t("profile.title")}</h1>

      {/* Account info card */}
      <div className="rounded border bg-white p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t("profile.account")}
        </h2>
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

      {/* GLN lookup card */}
      <div className="rounded border bg-white p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t("profile.gln")}
        </h2>

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

        {glnMsg && (
          <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
            {glnMsg}
          </div>
        )}
        {glnErr && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
            {glnErr}
          </div>
        )}
      </div>

      {/* Profile form card */}
      <div className="rounded border bg-white p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          {t("profile.details")}
        </h2>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {PROFILE_FIELDS.map(({ key, labelKey, half }) => (
            <div key={key} className={half ? "" : "col-span-2"}>
              <label className="block text-xs text-gray-500 mb-1">{t(labelKey)}</label>
              <input
                type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                value={fields[key]}
                onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full rounded border px-3 py-2 text-sm text-gray-700"
              />
            </div>
          ))}
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
        {saveMsg && (
          <span className="text-sm text-green-700">{saveMsg}</span>
        )}
        {saveErr && (
          <span className="text-sm text-red-600">{saveErr}</span>
        )}
      </div>
    </div>
  );
}
