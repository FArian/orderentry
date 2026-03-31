"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { useRefresh } from "@/lib/refresh";
import { sasísEnabled } from "@/config";
import {
  DataTable,
  DataTableHead,
  DataTableHeadRow,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from "@/components/Table";

// ── FHIR Patient types ────────────────────────────────────────────────────────

type HumanName = {
  use?: string;
  text?: string;
  given?: string[];
  family?: string;
  prefix?: string[];
  suffix?: string[];
};
type Address = {
  use?: string;
  type?: string;
  text?: string;
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};
type Coding = { display?: string };
type CodeableConcept = { text?: string; coding?: Coding[] };
type Telecom = { system?: string; value?: string; use?: string };
type Identifier = {
  use?: string;
  system?: string;
  value?: string;
  assigner?: { display?: string };
  type?: CodeableConcept;
};
type Patient = {
  resourceType: "Patient";
  id?: string;
  active?: boolean;
  name?: HumanName[];
  gender?: string;
  birthDate?: string;
  address?: Address[];
  telecom?: Telecom[];
  identifier?: Identifier[];
  maritalStatus?: CodeableConcept;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  managingOrganization?: { display?: string; reference?: string };
  meta?: { lastUpdated?: string; versionId?: string };
};

type OrderRow = {
  id: string;
  status: string;
  intent: string;
  codeText: string;
  authoredOn: string;
  orderNumber: string;
  specimenCount: number;
};

type BefundRow = {
  id: string;
  status: string;
  codeText: string;
  category: string;
  effectiveDate: string;
  resultCount: number;
  conclusion: string;
  basedOn: string[];
  pdfData: string | null;
  pdfTitle: string | null;
  hl7Data: string | null;
  hl7Title: string | null;
};

type ModalState =
  | { type: "pdf"; data: string; title: string }
  | { type: "hl7"; content: string; title: string }
  | null;

type Tab = "orders" | "befunde";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date?: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function nameToString(names?: HumanName[]): string {
  if (!names || names.length === 0) return "Unbekannt";
  const n = names[0];
  if (n.text && n.text.trim()) return n.text.trim();
  const parts = [
    ...(n.prefix || []),
    ...(n.given || []),
    n.family || "",
    ...(n.suffix || []),
  ].filter(Boolean);
  return parts.join(" ") || "Unbekannt";
}

function addressToString(addrs?: Address[]): string {
  if (!addrs || addrs.length === 0) return "";
  const a = addrs[0];
  if (a.text && a.text.trim()) return a.text.trim();
  const parts = [
    ...(a.line || []),
    a.postalCode,
    a.city,
    a.state,
    a.country,
  ].filter(Boolean);
  return parts.join(", ");
}

function genderKey(g?: string): string {
  switch (g) {
    case "male": return "patient.gender_male";
    case "female": return "patient.gender_female";
    case "other": return "patient.gender_other";
    case "unknown": return "patient.gender_unknown";
    default: return g || "";
  }
}

function systemLabel(system?: string): string {
  switch (system) {
    case "phone": return "Telefon";
    case "email": return "E‑Mail";
    case "fax": return "Fax";
    case "url": return "Web";
    default: return "Kontakt";
  }
}

function labelForUse(use?: string): string | undefined {
  switch (use) {
    case "home": return "privat";
    case "work": return "geschäftlich";
    case "mobile": return "mobil";
    case "temp": return "temporär";
    case "old": return "alt";
    default: return use || undefined;
  }
}

function b64toDataUrl(b64: string, mime: string): string {
  return `data:${mime};base64,${b64}`;
}

function decodeB64Utf8(b64: string): string {
  try {
    return decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
  } catch {
    return atob(b64);
  }
}

// ── Order status badges ───────────────────────────────────────────────────────

type OrderStatusMeta = { icon: string; badge: string; tooltipKey: string; editable: boolean };

function getOrderStatusMeta(status: string): OrderStatusMeta {
  switch (status) {
    case "draft":           return { icon: "✏️", badge: "bg-gray-100 text-gray-700 border-gray-300",      tooltipKey: "orders.tooltipDraft",     editable: true  };
    case "active":          return { icon: "📤", badge: "bg-blue-100 text-blue-700 border-blue-300",       tooltipKey: "orders.tooltipActive",    editable: true  };
    case "on-hold":         return { icon: "⏸️", badge: "bg-yellow-100 text-yellow-700 border-yellow-300", tooltipKey: "orders.tooltipOnHold",    editable: true  };
    case "completed":       return { icon: "✅", badge: "bg-green-100 text-green-700 border-green-300",    tooltipKey: "orders.tooltipCompleted", editable: false };
    case "revoked":         return { icon: "🚫", badge: "bg-red-100 text-red-700 border-red-300",          tooltipKey: "orders.tooltipRevoked",   editable: false };
    case "entered-in-error":return { icon: "⚠️", badge: "bg-red-100 text-red-700 border-red-300",          tooltipKey: "orders.tooltipError",     editable: false };
    default:                return { icon: "❓", badge: "bg-gray-100 text-gray-500 border-gray-200",       tooltipKey: "orders.statusUnknown",    editable: false };
  }
}

function orderStatusLabel(status: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    draft: t("orders.statusDraft"), active: t("orders.statusActive"),
    "on-hold": t("orders.statusOnHold"), completed: t("orders.statusCompleted"),
    revoked: t("orders.statusRevoked"), "entered-in-error": t("orders.statusError"),
  };
  return map[status] || t("orders.statusUnknown");
}

function OrderStatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const meta = getOrderStatusMeta(status);
  return (
    <div className="relative group inline-block">
      <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium cursor-default select-none ${meta.badge}`}>
        <span>{meta.icon}</span>
        <span>{orderStatusLabel(status, t)}</span>
      </span>
      <div className="pointer-events-none absolute left-0 top-full mt-1 z-50 w-72 rounded border border-gray-200 bg-white shadow-lg px-3 py-2 text-xs text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="font-semibold mb-1 flex items-center gap-1">
          <span>{meta.icon}</span><span>{orderStatusLabel(status, t)}</span>
        </div>
        <p className="leading-relaxed text-gray-600">{t(meta.tooltipKey)}</p>
      </div>
    </div>
  );
}

// ── Befund (DiagnosticReport) status badges ───────────────────────────────────

type BefundStatusMeta = { icon: string; badge: string; label: string; tooltip: string };

function getBefundStatusMeta(status: string, t: (k: string) => string): BefundStatusMeta {
  switch (status) {
    case "registered":  return { icon: "📝", badge: "bg-gray-100 text-gray-700 border-gray-300",      label: t("befunde.statusRegistered"),  tooltip: t("befunde.tooltipRegistered") };
    case "partial":     return { icon: "⏳", badge: "bg-yellow-100 text-yellow-700 border-yellow-300", label: t("befunde.statusPartial"),     tooltip: t("befunde.tooltipPartial") };
    case "preliminary": return { icon: "🔬", badge: "bg-blue-100 text-blue-700 border-blue-300",      label: t("befunde.statusPreliminary"), tooltip: t("befunde.tooltipPreliminary") };
    case "final":       return { icon: "✅", badge: "bg-green-100 text-green-700 border-green-300",   label: t("befunde.statusFinal"),       tooltip: t("befunde.tooltipFinal") };
    case "amended":     return { icon: "✏️", badge: "bg-purple-100 text-purple-700 border-purple-300", label: t("befunde.statusAmended"),    tooltip: t("befunde.tooltipAmended") };
    case "corrected":   return { icon: "🔄", badge: "bg-purple-100 text-purple-700 border-purple-300", label: t("befunde.statusCorrected"),  tooltip: t("befunde.tooltipCorrected") };
    case "cancelled":   return { icon: "🚫", badge: "bg-red-100 text-red-700 border-red-300",         label: t("befunde.statusCancelled"),   tooltip: t("befunde.tooltipCancelled") };
    default:            return { icon: "❓", badge: "bg-gray-100 text-gray-500 border-gray-200",      label: status || "?",                  tooltip: "" };
  }
}

function BefundStatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const meta = getBefundStatusMeta(status, t);
  return (
    <div className="relative group inline-block">
      <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium cursor-default select-none ${meta.badge}`}>
        <span>{meta.icon}</span><span>{meta.label}</span>
      </span>
      {meta.tooltip && (
        <div className="pointer-events-none absolute left-0 top-full mt-1 z-50 w-64 rounded border border-gray-200 bg-white shadow-lg px-3 py-2 text-xs text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div className="font-semibold mb-1">{meta.icon} {meta.label}</div>
          <p className="leading-relaxed text-gray-600">{meta.tooltip}</p>
        </div>
      )}
    </div>
  );
}

// ── Preview helpers ───────────────────────────────────────────────────────────

function PreviewButtons({
  pdfData, pdfTitle, hl7Data, hl7Title, onOpen,
}: {
  pdfData: string | null; pdfTitle: string | null;
  hl7Data: string | null; hl7Title: string | null;
  onOpen: (modal: ModalState) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {pdfData && (
        <button
          onClick={() => onOpen({ type: "pdf", data: b64toDataUrl(pdfData, "application/pdf"), title: pdfTitle || "PDF" })}
          className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-100"
        >
          📄 PDF
        </button>
      )}
      {hl7Data && (
        <button
          onClick={() => onOpen({ type: "hl7", content: decodeB64Utf8(hl7Data), title: hl7Title || "HL7" })}
          className="inline-flex items-center gap-1 rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100"
        >
          🔬 HL7
        </button>
      )}
    </div>
  );
}

function PreviewModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!modal) return null;

  function copy() {
    const text = modal!.type === "hl7" ? (modal as { type: "hl7"; content: string }).content : "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl flex flex-col"
        style={{ width: "900px", maxWidth: "96vw", height: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <span className="font-semibold text-gray-800 flex items-center gap-2">
            {modal.type === "pdf" ? "📄" : "🔬"}
            {modal.title}
          </span>
          <div className="flex items-center gap-2">
            {modal.type === "pdf" && (
              <a
                href={(modal as { type: "pdf"; data: string }).data}
                download={`${modal.title}.pdf`}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                ⬇️ Download
              </a>
            )}
            {modal.type === "hl7" && (
              <button
                onClick={copy}
                className={`px-3 py-1 rounded text-sm border ${copied ? "bg-green-100 border-green-400 text-green-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              >
                {copied ? "✓ Kopiert" : "📋 Kopieren"}
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl px-1">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {modal.type === "pdf" && (
            <iframe
              src={(modal as { type: "pdf"; data: string }).data}
              className="w-full h-full border-0"
              title={modal.title}
            />
          )}
          {modal.type === "hl7" && (
            <pre className="h-full text-xs font-mono bg-gray-950 text-green-300 p-4 whitespace-pre overflow-auto">
              {(modal as { type: "hl7"; content: string }).content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PatientDetailClient({ id }: { id: string }) {
  const { t: tr } = useTranslation();
  const { refreshCount, refresh } = useRefresh();

  // Patient demographics
  const [data, setData] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Insurance edit
  const [editMode, setEditMode] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editFields, setEditFields] = useState({
    ahv: "", ik: "", vnr: "", veka: "", insurerName: "",
  });
  const [lookupCard, setLookupCard] = useState("");
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Orders
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flashMsg, setFlashMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Befunde (DiagnosticReports)
  const [befunde, setBefunde] = useState<BefundRow[]>([]);
  const [befundeLoading, setBefundeLoading] = useState(true);
  const [befundeError, setBefundeError] = useState<string | null>(null);

  // PDF/HL7 preview modal
  const [modal, setModal] = useState<ModalState>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<Tab>("orders");

  // ── Fetches ───────────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/patients/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        setData((await res.json()) as Patient);
      })
      .catch((e: unknown) => {
        if (active) { setError(e instanceof Error ? e.message : String(e)); setData(null); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, refreshCount]);

  useEffect(() => {
    let active = true;
    setOrdersLoading(true);
    setOrdersError(null);
    setOrders([]);
    fetch(`/api/patients/${encodeURIComponent(id)}/service-requests`)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const json = (await res.json()) as { data: OrderRow[] };
        setOrders(json.data || []);
      })
      .catch((e: unknown) => {
        if (active) { setOrdersError(e instanceof Error ? e.message : String(e)); setOrders([]); }
      })
      .finally(() => { if (active) setOrdersLoading(false); });
    return () => { active = false; };
  }, [id, refreshCount]);

  useEffect(() => {
    let active = true;
    setBefundeLoading(true);
    setBefundeError(null);
    setBefunde([]);
    fetch(`/api/patients/${encodeURIComponent(id)}/diagnostic-reports`)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: BefundRow[] };
        setBefunde(Array.isArray(json.data) ? json.data : []);
      })
      .catch((e: unknown) => {
        if (active) { setBefundeError(e instanceof Error ? e.message : String(e)); setBefunde([]); }
      })
      .finally(() => { if (active) setBefundeLoading(false); });
    return () => { active = false; };
  }, [id, refreshCount]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleDeleteOrder = useCallback(
    async (orderId: string) => {
      if (!window.confirm(tr("orders.deleteConfirm"))) return;
      setDeletingId(orderId);
      try {
        const res = await fetch(`/api/service-requests/${orderId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setFlashMsg({ text: tr("orders.deleteOk"), ok: true });
        refresh();
      } catch (e: unknown) {
        setFlashMsg({ text: `${tr("orders.deleteError")}: ${e instanceof Error ? e.message : String(e)}`, ok: false });
      } finally {
        setDeletingId(null);
        window.setTimeout(() => setFlashMsg(null), 3000);
      }
    },
    [tr, refresh]
  );

  // ── Computed ──────────────────────────────────────────────────────────────

  const rows = useMemo(() => {
    const p = data;
    if (!p) return [] as Array<{ label: string; value: string }>;
    const list: Array<{ label: string; value: string }> = [];
    list.push({ label: tr("patient.id"), value: p.id || "-" });
    if (typeof p.active === "boolean")
      list.push({ label: tr("patient.active"), value: p.active ? tr("common.yes") : tr("common.no") });
    if (p.name && p.name.length)
      list.push({ label: tr("patient.name"), value: nameToString(p.name) });
    if (p.gender)
      list.push({ label: tr("patient.gender"), value: tr(genderKey(p.gender)) });
    if (p.birthDate)
      list.push({ label: tr("patient.birthdate"), value: formatDate(p.birthDate) });
    if (p.address && p.address.length)
      list.push({ label: tr("patient.address"), value: addressToString(p.address) });
    if (p.telecom && p.telecom.length) {
      p.telecom.forEach((t) => {
        const labelBase = systemLabel(t.system);
        const variant = labelForUse(t.use);
        const label = variant ? `${labelBase} (${variant})` : labelBase;
        if (t.value) list.push({ label, value: t.value });
      });
    }
    if (p.maritalStatus) {
      const ms = p.maritalStatus.text || p.maritalStatus.coding?.[0]?.display;
      if (ms) list.push({ label: tr("patient.maritalStatus"), value: ms });
    }
    if (typeof p.deceasedBoolean === "boolean")
      list.push({ label: tr("patient.deceased"), value: p.deceasedBoolean ? tr("common.yes") : tr("common.no") });
    if (p.deceasedDateTime)
      list.push({ label: tr("patient.deceasedAt"), value: formatDate(p.deceasedDateTime) });
    if (p.managingOrganization?.display)
      list.push({ label: tr("patient.facility"), value: p.managingOrganization.display });
    if (p.meta?.lastUpdated)
      list.push({ label: tr("patient.lastUpdated"), value: formatDate(p.meta.lastUpdated) });
    return list;
  }, [data, tr]);

  // Befunde filtered to only those linked to this patient's orders
  const filteredBefunde = useMemo(() => {
    if (!befunde.length) return befunde;
    const orderIdSet = new Set(orders.map((o) => o.id));
    return befunde.filter((b) => {
      if (b.basedOn.length === 0) return true; // no basedOn → show (already patient-scoped by API)
      return b.basedOn.some((ref) => {
        const srId = ref.startsWith("ServiceRequest/") ? ref.slice("ServiceRequest/".length) : ref;
        return orderIdSet.has(srId);
      });
    });
  }, [befunde, orders]);

  // ── Early returns ─────────────────────────────────────────────────────────

  if (loading) return <div className="text-gray-600">{tr("common.loading")}</div>;
  if (error) return <div className="text-red-600">{tr("patient.loadError")}: {error}</div>;
  if (!data) return null;

  // ── Insurance field extraction ────────────────────────────────────────────

  const p = data as Patient;
  const ids = p.identifier || [];

  function findById(systemFragments: string[]): Identifier | undefined {
    return ids.find((i) =>
      systemFragments.some((f) => (i.system || "").toLowerCase().includes(f.toLowerCase()))
    );
  }

  const ahvId = findById(["2.16.756.5.32", "ahv", "nss"]);
  const ahvNumber = ahvId?.value || "";
  const vekaId = findById(["2.16.756.5.30.1.123.100.1.1", "veka", "card", "karte"]);
  const vekaNumber = vekaId?.value || "";
  const ikId = findById(["ik", "institutionskennzeichen", "ikk"]);
  const ikNumber = ikId?.value || "";
  const vnrId = findById(["vnr", "vertragsnr", "versicherungsnr", "policynr", "membernr"]);
  const vnrNumber = vnrId?.value || "";
  const insuranceId = ikId || vnrId || vekaId;
  const insurerName = insuranceId?.assigner?.display || p.managingOrganization?.display || "";

  const leftCol = [
    { label: tr("patient.name"), value: nameToString(p.name) },
    { label: tr("patient.birthdate"), value: formatDate(p.birthDate) },
    { label: tr("patient.gender"), value: tr(genderKey(p.gender)) },
    { label: tr("patient.address"), value: addressToString(p.address) },
    { label: tr("patient.ahv"), value: ahvNumber },
  ];

  const insuranceDisplay = { insurerName, ikNumber, vnrNumber, vekaNumber, ahvNumber };

  function startEdit() {
    setEditFields({ ahv: ahvNumber, ik: ikNumber, vnr: vnrNumber, veka: vekaNumber, insurerName });
    setSaveMsg(null);
    setSaveErr(null);
    setEditMode(true);
  }

  async function lookupByCard() {
    setLookupLoading(true);
    setLookupMsg(null);
    setLookupErr(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/insurance-lookup?cardNumber=${encodeURIComponent(lookupCard)}&date=${today}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Fehler: ${res.status}`);
      setEditFields((prev) => ({
        ...prev,
        insurerName: json.insurerName || prev.insurerName,
        ik: json.ik || prev.ik,
        veka: json.veka || prev.veka,
        ahv: json.ahv || prev.ahv,
      }));
      setLookupMsg(`${tr("insurance.lookupFound")}: ${json.insurerName || ""} — ${json.familyname || ""} ${json.givenname || ""}`);
    } catch (e: unknown) {
      setLookupErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLookupLoading(false);
    }
  }

  async function saveInsurance() {
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editFields),
      });
      if (!res.ok) throw new Error(`Fehler: ${res.status}`);
      const updated = await res.json();
      setData(updated);
      setEditMode(false);
      setSaveMsg(tr("insurance.saved"));
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PreviewModal modal={modal} onClose={() => setModal(null)} />

      {/* Two-column patient summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <dl className="divide-y divide-gray-200">
          {leftCol.map((r) => (
            <div key={r.label} className="py-2 grid grid-cols-3 gap-4">
              <dt className="text-sm text-gray-500">{r.label}</dt>
              <dd className="text-sm text-gray-900 col-span-2">{r.value || "-"}</dd>
            </div>
          ))}
        </dl>

        {/* Insurance */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{tr("insurance.title")}</span>
            {!editMode && (
              <button onClick={startEdit} className="text-xs text-blue-600 hover:underline">
                {tr("insurance.edit")}
              </button>
            )}
          </div>
          {saveMsg && <div className="mb-2 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">{saveMsg}</div>}
          {saveErr && <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">{saveErr}</div>}
          {editMode ? (
            <div className="flex flex-col gap-2">
              {sasísEnabled ? (
                <div className="rounded bg-blue-50 border border-blue-200 p-2">
                  <div className="text-xs font-medium text-blue-800 mb-1">{tr("insurance.lookup")}</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={lookupCard}
                      onChange={(e) => setLookupCard(e.target.value.replace(/\D/g, ""))}
                      placeholder={tr("insurance.lookupPlaceholder")}
                      maxLength={20}
                      className="flex-1 rounded border px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={lookupByCard}
                      disabled={lookupLoading || lookupCard.length !== 20}
                      className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:bg-blue-300"
                    >
                      {lookupLoading ? tr("common.searching") : tr("common.search")}
                    </button>
                  </div>
                  {lookupMsg && <div className="mt-1 text-xs text-green-700">{lookupMsg}</div>}
                  {lookupErr && <div className="mt-1 text-xs text-red-600">{lookupErr}</div>}
                </div>
              ) : (
                <div className="rounded bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-400">
                  {tr("insurance.noSasis")}
                </div>
              )}
              {(["insurerName", "ik", "vnr", "veka", "ahv"] as const).map((field) => (
                <div key={field}>
                  <label className="text-xs text-gray-500">
                    {field === "insurerName" ? tr("insurance.name")
                      : field === "ik" ? tr("insurance.ik")
                      : field === "vnr" ? tr("insurance.vnr")
                      : field === "veka" ? tr("insurance.veka")
                      : tr("insurance.ahv")}
                  </label>
                  <input
                    type="text"
                    value={editFields[field]}
                    onChange={(e) => setEditFields((prev) => ({ ...prev, [field]: e.target.value }))}
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm text-gray-700"
                  />
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <button onClick={saveInsurance} disabled={saving} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:bg-blue-300">
                  {saving ? tr("common.saving") : tr("common.save")}
                </button>
                <button onClick={() => setEditMode(false)} className="px-3 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">
                  {tr("common.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <dl className="divide-y divide-gray-200 mt-2">
              {[
                { label: tr("insurance.name"), value: insuranceDisplay.insurerName },
                { label: tr("insurance.ik"), value: insuranceDisplay.ikNumber },
                { label: tr("insurance.vnr"), value: insuranceDisplay.vnrNumber },
                { label: tr("insurance.veka"), value: insuranceDisplay.vekaNumber },
              ].map((r) => (
                <div key={r.label} className="py-2 grid grid-cols-3 gap-4">
                  <dt className="text-sm text-gray-500">{r.label}</dt>
                  <dd className="text-sm text-gray-900 col-span-2">{r.value || "-"}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b mb-4">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("orders")}
            className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "orders"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            📋 {tr("orders.title")}
            {orders.length > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-xs">
                {orders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("befunde")}
            className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "befunde"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            🔬 {tr("befunde.title")}
            {filteredBefunde.length > 0 && (
              <span className="ml-1.5 rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-xs">
                {filteredBefunde.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Orders tab ─────────────────────────────────────────────────────── */}
      {activeTab === "orders" && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">{tr("orders.title")}</h2>
            {flashMsg && (
              <div className={`rounded border px-3 py-1 text-sm ${flashMsg.ok ? "border-green-300 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"}`}>
                {flashMsg.text}
              </div>
            )}
          </div>
          <DataTable>
            <DataTableHead>
              <DataTableHeadRow>
                <DataTableHeaderCell className="w-52">{tr("orders.id")}</DataTableHeaderCell>
                <DataTableHeaderCell>{tr("orders.description")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-44">{tr("orders.status")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-36">{tr("orders.date")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-20 text-center">{tr("orders.specimens")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-40">{tr("orders.actions")}</DataTableHeaderCell>
              </DataTableHeadRow>
            </DataTableHead>
            <DataTableBody>
              {ordersLoading &&
                Array.from({ length: 4 }, (_, i) => (
                  <DataTableRow key={`ord-skel-${i}`}>
                    {Array.from({ length: 6 }, (__, j) => (
                      <DataTableCell key={j}><div className="h-4 rounded bg-gray-100 animate-pulse" /></DataTableCell>
                    ))}
                  </DataTableRow>
                ))}
              {!ordersLoading && ordersError && (
                <DataTableRow>
                  <DataTableCell className="text-red-600" colSpan={6}>
                    {tr("orders.loadError")}: {ordersError}
                  </DataTableCell>
                </DataTableRow>
              )}
              {!ordersLoading && !ordersError && orders.length === 0 && (
                <DataTableRow>
                  <DataTableCell className="text-gray-500" colSpan={6}>
                    {tr("orders.noResults")}
                  </DataTableCell>
                </DataTableRow>
              )}
              {!ordersLoading && !ordersError &&
                orders.map((o) => {
                  const meta = getOrderStatusMeta(o.status);
                  const canEdit = meta.editable;
                  const isDeleting = deletingId === o.id;
                  return (
                    <DataTableRow key={o.id} className={isDeleting ? "opacity-40" : ""}>
                      <DataTableCell title={o.orderNumber || o.id} className="font-mono text-xs">
                        {o.orderNumber || o.id}
                      </DataTableCell>
                      <DataTableCell title={o.codeText}>{o.codeText || "-"}</DataTableCell>
                      <DataTableCell><OrderStatusBadge status={o.status} t={tr} /></DataTableCell>
                      <DataTableCell>{formatDate(o.authoredOn)}</DataTableCell>
                      <DataTableCell className="text-center">{o.specimenCount || 0}</DataTableCell>
                      <DataTableCell>
                        <div className="flex items-center gap-1.5">
                          {canEdit ? (
                            <Link
                              href={`/order/${id}?sr=${o.id}`}
                              className="inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100"
                              title={tr("orders.edit")}
                            >
                              ✏️ {tr("orders.edit")}
                            </Link>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-400 cursor-default"
                              title={tr("orders.locked")}
                            >
                              🔒 {tr("orders.locked")}
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteOrder(o.id)}
                            disabled={isDeleting}
                            title={tr("orders.delete")}
                            className="inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600 hover:bg-red-100 disabled:opacity-40"
                          >
                            🗑️
                          </button>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
            </DataTableBody>
          </DataTable>
        </>
      )}

      {/* ── Befunde tab ─────────────────────────────────────────────────────── */}
      {activeTab === "befunde" && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">{tr("befunde.title")}</h2>
            <Link
              href={`/patient/${encodeURIComponent(id)}/befunde`}
              className="text-xs text-blue-600 hover:underline"
            >
              {tr("befunde.title")} → vollständige Ansicht
            </Link>
          </div>
          <DataTable>
            <DataTableHead>
              <DataTableHeadRow>
                <DataTableHeaderCell>{tr("befunde.code")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-36">{tr("befunde.category")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-40">{tr("befunde.status")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-32">{tr("befunde.date")}</DataTableHeaderCell>
                <DataTableHeaderCell>{tr("befunde.result")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-36">{tr("befunde.documents")}</DataTableHeaderCell>
              </DataTableHeadRow>
            </DataTableHead>
            <DataTableBody>
              {befundeLoading &&
                Array.from({ length: 4 }, (_, i) => (
                  <DataTableRow key={`bef-skel-${i}`}>
                    {Array.from({ length: 6 }, (__, j) => (
                      <DataTableCell key={j}><div className="h-4 rounded bg-gray-100 animate-pulse" /></DataTableCell>
                    ))}
                  </DataTableRow>
                ))}
              {!befundeLoading && befundeError && (
                <DataTableRow>
                  <DataTableCell className="text-red-600" colSpan={6}>
                    {tr("befunde.loadError")}: {befundeError}
                  </DataTableCell>
                </DataTableRow>
              )}
              {!befundeLoading && !befundeError && filteredBefunde.length === 0 && (
                <DataTableRow>
                  <DataTableCell className="text-gray-500" colSpan={6}>
                    {tr("befunde.noResults")}
                  </DataTableCell>
                </DataTableRow>
              )}
              {!befundeLoading && !befundeError &&
                filteredBefunde.map((b) => (
                  <DataTableRow key={b.id}>
                    <DataTableCell title={b.codeText}>{b.codeText || "-"}</DataTableCell>
                    <DataTableCell>{b.category || "-"}</DataTableCell>
                    <DataTableCell><BefundStatusBadge status={b.status} t={tr} /></DataTableCell>
                    <DataTableCell>{formatDate(b.effectiveDate)}</DataTableCell>
                    <DataTableCell>
                      <div className="text-xs text-gray-700">
                        {b.conclusion ? (
                          <span title={b.conclusion} className="block max-w-xs truncate">{b.conclusion}</span>
                        ) : (
                          <span className="text-gray-400">{b.resultCount} {tr("befunde.observations")}</span>
                        )}
                        {b.basedOn.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {b.basedOn.map((ref) => {
                              const srId = ref.startsWith("ServiceRequest/") ? ref.slice("ServiceRequest/".length) : ref;
                              return (
                                <Link key={ref} href={`/order/${id}?sr=${srId}`} className="text-blue-600 hover:underline text-xs">
                                  📋 {srId}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <PreviewButtons
                        pdfData={b.pdfData} pdfTitle={b.pdfTitle || b.codeText}
                        hl7Data={b.hl7Data} hl7Title={b.hl7Title || "HL7 ORU^R01"}
                        onOpen={setModal}
                      />
                    </DataTableCell>
                  </DataTableRow>
                ))}
            </DataTableBody>
          </DataTable>
        </>
      )}

      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
          Alle Daten (JSON) anzeigen
        </summary>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 p-4 text-xs overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
