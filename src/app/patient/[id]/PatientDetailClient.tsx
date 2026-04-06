"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { useRefresh } from "@/lib/refresh";
import { sasísEnabled } from "@/config";
import { formatDate } from "@/shared/utils/formatDate";
import {
  validateAhv, sanitizeAhv,
  validateVeka, sanitizeVeka, detectVekaCountry, VEKA_COUNTRIES,
} from "@/shared/utils/swissValidators";
import { b64toDataUrl, decodeB64Utf8 } from "@/shared/utils/base64";
import { AppSidebar } from "@/components/AppSidebar";

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

function nameToString(names?: HumanName[]): string {
  if (!names || names.length === 0) return "Unbekannt";
  const n = names[0];
  if (!n) return "Unbekannt";
  if (n.text && n.text.trim()) return n.text.trim();
  const parts = [
    ...(n.prefix || []),
    ...(n.given || []),
    n.family || "",
    ...(n.suffix || []),
  ].filter(Boolean);
  return parts.join(" ") || "Unbekannt";
}

function nameInitials(names?: HumanName[]): string {
  if (!names || names.length === 0) return "?";
  const n = names[0];
  if (!n) return "?";
  const given = n.given?.[0]?.[0] ?? "";
  const family = n.family?.[0] ?? "";
  if (given || family) return `${given}${family}`.toUpperCase();
  if (n.text) {
    const parts = n.text.trim().split(/\s+/);
    return parts.map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
  }
  return "?";
}

function addressToString(addrs?: Address[]): string {
  if (!addrs || addrs.length === 0) return "";
  const a = addrs[0];
  if (!a) return "";
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

// ── Order status badges ───────────────────────────────────────────────────────

type OrderStatusMeta = { label: string; pill: string; editable: boolean; tooltipKey: string };

function getOrderStatusMeta(status: string): OrderStatusMeta {
  switch (status) {
    case "draft":            return { label: "Entwurf",    pill: "bg-zt-warning-bg text-zt-warning-text",       editable: true,  tooltipKey: "orders.tooltipDraft"     };
    case "active":           return { label: "Aktiv",      pill: "bg-zt-primary-light text-zt-primary",         editable: true,  tooltipKey: "orders.tooltipActive"    };
    case "on-hold":          return { label: "Pausiert",   pill: "bg-zt-warning-bg text-zt-warning-text",       editable: true,  tooltipKey: "orders.tooltipOnHold"    };
    case "completed":        return { label: "Abgeschl.",  pill: "bg-zt-success-light text-zt-success",         editable: false, tooltipKey: "orders.tooltipCompleted" };
    case "revoked":          return { label: "Widerrufen", pill: "bg-zt-danger-light text-zt-danger",           editable: false, tooltipKey: "orders.tooltipRevoked"   };
    case "entered-in-error": return { label: "Fehler",     pill: "bg-zt-danger-light text-zt-danger",           editable: false, tooltipKey: "orders.tooltipError"     };
    default:                 return { label: status || "?", pill: "bg-zt-bg-muted text-zt-text-tertiary",       editable: false, tooltipKey: "orders.statusUnknown"    };
  }
}

function OrderStatusPill({ status, t }: { status: string; t: (k: string) => string }) {
  const meta = getOrderStatusMeta(status);
  return (
    <div className="relative group inline-block">
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-[500] cursor-default ${meta.pill}`}>
        {meta.label}
      </span>
      <div className="pointer-events-none absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border border-zt-border bg-zt-bg-card shadow-lg px-3 py-2 text-[12px] text-zt-text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <p className="leading-relaxed text-zt-text-secondary">{t(meta.tooltipKey)}</p>
      </div>
    </div>
  );
}

// ── Befund (DiagnosticReport) status badges ───────────────────────────────────

function getBefundPill(status: string): string {
  switch (status) {
    case "registered":  return "bg-zt-bg-muted text-zt-text-tertiary";
    case "partial":     return "bg-zt-warning-bg text-zt-warning-text";
    case "preliminary": return "bg-zt-primary-light text-zt-primary";
    case "final":       return "bg-zt-success-light text-zt-success";
    case "amended":
    case "corrected":   return "bg-zt-primary-light text-zt-primary";
    case "cancelled":   return "bg-zt-danger-light text-zt-danger";
    default:            return "bg-zt-bg-muted text-zt-text-tertiary";
  }
}

function getBefundLabel(status: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    registered: t("befunde.statusRegistered"),
    partial: t("befunde.statusPartial"),
    preliminary: t("befunde.statusPreliminary"),
    final: t("befunde.statusFinal"),
    amended: t("befunde.statusAmended"),
    corrected: t("befunde.statusCorrected"),
    cancelled: t("befunde.statusCancelled"),
  };
  return map[status] || status || "?";
}

function BefundStatusPill({ status, t }: { status: string; t: (k: string) => string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-[500] ${getBefundPill(status)}`}>
      {getBefundLabel(status, t)}
    </span>
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
          className="inline-flex items-center gap-1 rounded-md border border-zt-danger-border bg-zt-danger-light px-2 py-0.5 text-[11px] text-zt-danger hover:opacity-80"
        >
          PDF
        </button>
      )}
      {hl7Data && (
        <button
          onClick={() => onOpen({ type: "hl7", content: decodeB64Utf8(hl7Data), title: hl7Title || "HL7" })}
          className="inline-flex items-center gap-1 rounded-md border border-zt-primary-border bg-zt-primary-light px-2 py-0.5 text-[11px] text-zt-primary hover:opacity-80"
        >
          HL7
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
        className="bg-zt-bg-card rounded-xl border border-zt-border shadow-2xl flex flex-col"
        style={{ width: "900px", maxWidth: "96vw", height: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zt-border px-4 py-3 shrink-0">
          <span className="font-[500] text-zt-text-primary text-[14px]">{modal.title}</span>
          <div className="flex items-center gap-2">
            {modal.type === "pdf" && (
              <a
                href={(modal as { type: "pdf"; data: string }).data}
                download={`${modal.title}.pdf`}
                className="rounded-lg border border-zt-border bg-zt-bg-page px-3 py-1 text-[12px] text-zt-text-secondary hover:bg-zt-bg-muted"
              >
                Download
              </a>
            )}
            {modal.type === "hl7" && (
              <button
                onClick={copy}
                className={`px-3 py-1 rounded-lg text-[12px] border ${copied ? "bg-zt-success-light border-zt-success-border text-zt-success" : "bg-zt-bg-page border-zt-border text-zt-text-secondary hover:bg-zt-bg-muted"}`}
              >
                {copied ? "Kopiert" : "Kopieren"}
              </button>
            )}
            <button onClick={onClose} className="text-zt-text-tertiary hover:text-zt-text-primary text-[20px] px-1 leading-none">×</button>
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
            <pre className="h-full text-[12px] font-mono bg-gray-950 text-green-300 p-4 whitespace-pre overflow-auto">
              {(modal as { type: "hl7"; content: string }).content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconSearch = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
    <circle cx="6.5" cy="6.5" r="4" /><path d="m10 10 2.5 2.5" strokeLinecap="round" />
  </svg>
);

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

  // Active tab + search
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [tabSearch, setTabSearch] = useState("");

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

  const filteredBefunde = useMemo(() => {
    if (!befunde.length) return befunde;
    const orderIdSet = new Set(orders.map((o) => o.id));
    return befunde.filter((b) => {
      if (b.basedOn.length === 0) return true;
      return b.basedOn.some((ref) => {
        const srId = ref.startsWith("ServiceRequest/") ? ref.slice("ServiceRequest/".length) : ref;
        return orderIdSet.has(srId);
      });
    });
  }, [befunde, orders]);

  const visibleOrders = useMemo(() => {
    if (!tabSearch.trim()) return orders;
    const q = tabSearch.toLowerCase();
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.codeText.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
    );
  }, [orders, tabSearch]);

  const visibleBefunde = useMemo(() => {
    if (!tabSearch.trim()) return filteredBefunde;
    const q = tabSearch.toLowerCase();
    return filteredBefunde.filter(
      (b) =>
        b.codeText.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.status.toLowerCase().includes(q)
    );
  }, [filteredBefunde, tabSearch]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - var(--zt-topbar-height))" }}>
      <AppSidebar />

      <main className="flex-1 overflow-y-auto px-8 py-7">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary mb-4">
          <Link href="/" className="text-zt-primary hover:underline">Dashboard</Link>
          <span>/</span>
          <Link href="/patients" className="text-zt-primary hover:underline">{tr("patient.title")}</Link>
          <span>/</span>
          <span className="text-zt-text-primary">{data ? nameToString(data.name) : id}</span>
        </nav>

        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[20px] font-[500] text-zt-text-primary">
            {loading ? tr("common.loading") : (data ? nameToString(data.name) : tr("patient.title"))}
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href={`/order/${encodeURIComponent(id)}`}
              className="inline-flex items-center gap-1.5 text-[12px] px-3.5 py-[6px] rounded-lg bg-zt-primary text-zt-text-on-primary border border-zt-primary hover:opacity-90"
            >
              {tr("home.order")}
            </Link>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 text-[12px] px-3.5 py-[6px] rounded-lg bg-zt-bg-card text-zt-text-primary border border-zt-border hover:bg-zt-bg-page"
            >
              {tr("nav.refresh")}
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-zt-text-secondary text-[13px] py-8">
            <svg className="w-4 h-4 animate-spin text-zt-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
            </svg>
            {tr("common.loading")}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-zt-danger-border bg-zt-danger-light px-4 py-3 text-[13px] text-zt-danger">
            {tr("patient.loadError")}: {error}
          </div>
        )}

        {!loading && !error && data && (() => {
          // Insurance field extraction
          const p = data;
          const ids = p.identifier || [];

          function findById(fragments: string[]): Identifier | undefined {
            return ids.find((i) =>
              fragments.some((f) => (i.system || "").toLowerCase().includes(f.toLowerCase()))
            );
          }

          const ahvId   = findById(["2.16.756.5.32", "ahv", "nss"]);
          const ahvNumber   = ahvId?.value || "";
          const vekaId  = findById(["2.16.756.5.30.1.123.100.1.1", "veka", "card", "karte"]);
          const vekaNumber  = vekaId?.value || "";
          const ikId    = findById(["ik", "institutionskennzeichen", "ikk"]);
          const ikNumber    = ikId?.value || "";
          const vnrId   = findById(["vnr", "vertragsnr", "versicherungsnr", "policynr", "membernr"]);
          const vnrNumber   = vnrId?.value || "";
          const insuranceId = ikId || vnrId || vekaId;
          const insurerName = insuranceId?.assigner?.display || "";
          const clinicName  = p.managingOrganization?.display || "";

          const leftCol = [
            { label: tr("patient.name"),    value: nameToString(p.name) },
            { label: tr("patient.birthdate"), value: formatDate(p.birthDate) },
            { label: tr("patient.gender"),  value: tr(genderKey(p.gender)) },
            { label: tr("patient.address"), value: addressToString(p.address) },
            ...(p.telecom || []).map((tc) => {
              const base = systemLabel(tc.system);
              const variant = labelForUse(tc.use);
              return { label: variant ? `${base} (${variant})` : base, value: tc.value || "" };
            }),
            { label: tr("patient.ahv"),     value: ahvNumber },
          ];

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

          const initials = nameInitials(p.name);

          return (
            <>
              <PreviewModal modal={modal} onClose={() => setModal(null)} />

              {/* ── Hero card ────────────────────────────────────────── */}
              <div className="bg-zt-bg-card border border-zt-border rounded-xl px-6 py-5 mb-5 flex gap-6 relative">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-zt-primary-light flex items-center justify-center text-[18px] font-[500] text-zt-primary shrink-0 select-none">
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[18px] font-[500] text-zt-text-primary mb-1">{nameToString(p.name)}</div>
                  <div className="flex gap-4 flex-wrap mb-3">
                    {p.birthDate && (
                      <div className="flex flex-col gap-px">
                        <span className="text-[10px] text-zt-text-tertiary uppercase tracking-wider">{tr("patient.birthdate")}</span>
                        <span className="text-[13px] text-zt-text-primary">{formatDate(p.birthDate)}</span>
                      </div>
                    )}
                    {p.gender && (
                      <div className="flex flex-col gap-px">
                        <span className="text-[10px] text-zt-text-tertiary uppercase tracking-wider">{tr("patient.gender")}</span>
                        <span className="text-[13px] text-zt-text-primary">{tr(genderKey(p.gender))}</span>
                      </div>
                    )}
                    {ahvNumber && (
                      <div className="flex flex-col gap-px">
                        <span className="text-[10px] text-zt-text-tertiary uppercase tracking-wider">{tr("patient.ahv")}</span>
                        <span className="text-[13px] text-zt-text-primary font-mono">{ahvNumber}</span>
                      </div>
                    )}
                    {p.meta?.lastUpdated && (
                      <div className="flex flex-col gap-px">
                        <span className="text-[10px] text-zt-text-tertiary uppercase tracking-wider">{tr("patient.lastUpdated")}</span>
                        <span className="text-[13px] text-zt-text-primary">{formatDate(p.meta.lastUpdated)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {p.active !== false && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-zt-success-light text-zt-success border border-zt-success-border">
                        {tr("patient.active")}
                      </span>
                    )}
                    {clinicName && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-zt-primary-light text-zt-primary border border-zt-primary-border">
                        {clinicName}
                      </span>
                    )}
                    {p.deceasedBoolean && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-zt-danger-light text-zt-danger border border-zt-danger-border">
                        {tr("patient.deceased")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit button (top-right) */}
                {!editMode && (
                  <button
                    onClick={startEdit}
                    className="absolute top-4 right-5 text-[12px] text-zt-primary flex items-center gap-1 hover:opacity-75"
                  >
                    {tr("insurance.edit")}
                  </button>
                )}
              </div>

              {/* ── Info grid (2 cols) ───────────────────────────────── */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                {/* Personal data */}
                <div className="bg-zt-bg-card border border-zt-border rounded-xl px-5 py-4">
                  <div className="text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wider mb-3">
                    {tr("patient.personalData") || "Persönliche Daten"}
                  </div>
                  {leftCol.map((r) => (
                    <div key={r.label} className="flex justify-between py-1.5 border-b border-zt-border last:border-0 text-[13px]">
                      <span className="text-zt-text-secondary">{r.label}</span>
                      <span className={`font-[500] text-right ${r.value ? "text-zt-text-primary" : "text-zt-text-tertiary"}`}>
                        {r.value || "–"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Insurance */}
                <div className="bg-zt-bg-card border border-zt-border rounded-xl px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wider">
                      {tr("insurance.title")}
                    </span>
                    {!editMode && (
                      <button onClick={startEdit} className="text-[11px] text-zt-primary hover:opacity-75">
                        {tr("insurance.edit")}
                      </button>
                    )}
                  </div>

                  {saveMsg && (
                    <div className="mb-2 text-[12px] text-zt-success bg-zt-success-light border border-zt-success-border px-3 py-1.5 rounded-lg">
                      {saveMsg}
                    </div>
                  )}
                  {saveErr && (
                    <div className="mb-2 text-[12px] text-zt-danger bg-zt-danger-light border border-zt-danger-border px-3 py-1.5 rounded-lg">
                      {saveErr}
                    </div>
                  )}

                  {editMode ? (
                    <div className="flex flex-col gap-2">
                      {sasísEnabled ? (
                        <div className="rounded-lg bg-zt-primary-light border border-zt-primary-border p-3">
                          <div className="text-[11px] font-[500] text-zt-primary mb-1.5">{tr("insurance.lookup")}</div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={lookupCard}
                              onChange={(e) => setLookupCard(e.target.value.replace(/\D/g, ""))}
                              placeholder={tr("insurance.lookupPlaceholder")}
                              maxLength={20}
                              className="flex-1 rounded-lg border border-zt-border px-2.5 py-1.5 text-[12px] bg-zt-bg-card text-zt-text-primary outline-none focus:border-zt-primary"
                            />
                            <button
                              type="button"
                              onClick={lookupByCard}
                              disabled={lookupLoading || lookupCard.length !== 20}
                              className="px-3 py-1.5 rounded-lg bg-zt-primary text-zt-text-on-primary text-[12px] hover:opacity-90 disabled:opacity-40"
                            >
                              {lookupLoading ? tr("common.searching") : tr("common.search")}
                            </button>
                          </div>
                          {lookupMsg && <div className="mt-1 text-[11px] text-zt-success">{lookupMsg}</div>}
                          {lookupErr && <div className="mt-1 text-[11px] text-zt-danger">{lookupErr}</div>}
                        </div>
                      ) : (
                        <div className="rounded-lg bg-zt-bg-muted border border-zt-border px-3 py-2 text-[11px] text-zt-text-tertiary">
                          {tr("insurance.noSasis")}
                        </div>
                      )}
                      {(["insurerName", "ik", "vnr"] as const).map((field) => (
                        <div key={field}>
                          <label className="text-[11px] text-zt-text-tertiary">
                            {field === "insurerName" ? tr("insurance.name")
                              : field === "ik" ? tr("insurance.ik")
                              : tr("insurance.vnr")}
                          </label>
                          <input
                            type="text"
                            value={editFields[field]}
                            onChange={(e) => setEditFields((prev) => ({ ...prev, [field]: e.target.value }))}
                            className="mt-0.5 w-full rounded-lg border border-zt-border px-2.5 py-1.5 text-[12px] text-zt-text-primary bg-zt-bg-card outline-none focus:border-zt-primary"
                          />
                        </div>
                      ))}

                      {/* VEKA — with auto country detection */}
                      <div>
                        <label className="text-[11px] text-zt-text-tertiary">{tr("insurance.veka")}</label>
                        <input
                          type="text"
                          value={editFields.veka}
                          onChange={(e) => {
                            const s = sanitizeVeka(e.target.value);
                            setEditFields((prev) => ({ ...prev, veka: s }));
                          }}
                          placeholder="80756…"
                          maxLength={20}
                          className={`mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-[12px] text-zt-text-primary bg-zt-bg-card outline-none focus:border-zt-primary ${
                            editFields.veka && !validateVeka(editFields.veka).valid
                              ? "border-zt-danger"
                              : editFields.veka.length === 20 && validateVeka(editFields.veka).valid
                              ? "border-zt-success"
                              : "border-zt-border"
                          }`}
                        />
                        {(() => {
                          if (!editFields.veka) return null;
                          const v = validateVeka(editFields.veka);
                          const country = detectVekaCountry(editFields.veka);
                          if (!v.valid && editFields.veka.length >= 5)
                            return <p className="mt-0.5 text-[10px] text-zt-danger">{v.error}</p>;
                          if (country && VEKA_COUNTRIES[country])
                            return <p className="mt-0.5 text-[10px] text-zt-success">✓ Land erkannt: {VEKA_COUNTRIES[country]}</p>;
                          return null;
                        })()}
                        <p className="mt-0.5 text-[10px] text-zt-text-tertiary">20 Stellen · CH: 80756… · LI: 80438… · DE: 80276…</p>
                      </div>

                      {/* AHV — with format auto-insert */}
                      <div>
                        <label className="text-[11px] text-zt-text-tertiary">{tr("insurance.ahv")}</label>
                        <input
                          type="text"
                          value={editFields.ahv}
                          onChange={(e) => {
                            const s = sanitizeAhv(e.target.value);
                            setEditFields((prev) => ({ ...prev, ahv: s }));
                          }}
                          placeholder="756.XXXX.XXXX.XX"
                          maxLength={16}
                          className={`mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-[12px] font-mono text-zt-text-primary bg-zt-bg-card outline-none focus:border-zt-primary ${
                            editFields.ahv && !validateAhv(editFields.ahv).valid
                              ? "border-zt-danger"
                              : editFields.ahv && validateAhv(editFields.ahv).valid
                              ? "border-zt-success"
                              : "border-zt-border"
                          }`}
                        />
                        {(() => {
                          if (!editFields.ahv) return null;
                          const v = validateAhv(editFields.ahv);
                          if (!v.valid) return <p className="mt-0.5 text-[10px] text-zt-danger">{v.error}</p>;
                          return <p className="mt-0.5 text-[10px] text-zt-success">✓ {v.hint}</p>;
                        })()}
                        <p className="mt-0.5 text-[10px] text-zt-text-tertiary">Format: 756.XXXX.XXXX.XX · Beginnt immer mit 756</p>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={saveInsurance}
                          disabled={saving}
                          className="px-3.5 py-1.5 rounded-lg bg-zt-primary text-zt-text-on-primary text-[12px] hover:opacity-90 disabled:opacity-40"
                        >
                          {saving ? tr("common.saving") : tr("common.save")}
                        </button>
                        <button
                          onClick={() => setEditMode(false)}
                          className="px-3.5 py-1.5 rounded-lg border border-zt-border text-[12px] text-zt-text-secondary hover:bg-zt-bg-page"
                        >
                          {tr("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {[
                        { label: tr("insurance.name"), value: insurerName },
                        { label: tr("insurance.ik"),   value: ikNumber },
                        { label: tr("insurance.vnr"),  value: vnrNumber },
                        { label: tr("insurance.veka"), value: vekaNumber },
                      ].map((r) => (
                        <div key={r.label} className="flex justify-between py-1.5 border-b border-zt-border last:border-0 text-[13px]">
                          <span className="text-zt-text-secondary">{r.label}</span>
                          <span className={`font-[500] text-right ${r.value ? "text-zt-text-primary" : "text-zt-text-tertiary"}`}>
                            {r.value || "–"}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* ── Tabs ─────────────────────────────────────────────── */}
              <div className="flex border-b border-zt-border bg-zt-bg-card rounded-t-xl overflow-hidden">
                <button
                  onClick={() => { setActiveTab("orders"); setTabSearch(""); }}
                  className={`px-5 py-3 text-[13px] flex items-center gap-1.5 border-b-2 transition-colors ${
                    activeTab === "orders"
                      ? "border-zt-primary text-zt-primary font-[500] bg-zt-bg-card"
                      : "border-transparent text-zt-text-secondary hover:text-zt-text-primary hover:bg-zt-bg-page"
                  }`}
                >
                  {tr("orders.title")}
                  {orders.length > 0 && (
                    <span className="text-[10px] bg-zt-primary text-zt-text-on-primary px-1.5 py-0.5 rounded-full">
                      {orders.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setActiveTab("befunde"); setTabSearch(""); }}
                  className={`px-5 py-3 text-[13px] flex items-center gap-1.5 border-b-2 transition-colors ${
                    activeTab === "befunde"
                      ? "border-zt-success text-zt-success font-[500] bg-zt-bg-card"
                      : "border-transparent text-zt-text-secondary hover:text-zt-text-primary hover:bg-zt-bg-page"
                  }`}
                >
                  {tr("befunde.title")}
                  {filteredBefunde.length > 0 && (
                    <span className="text-[10px] bg-zt-success text-zt-text-on-primary px-1.5 py-0.5 rounded-full">
                      {filteredBefunde.length}
                    </span>
                  )}
                </button>
              </div>

              {/* ── Tab content ───────────────────────────────────────── */}
              <div className="bg-zt-bg-card border border-zt-border border-t-0 rounded-b-xl overflow-hidden mb-5">
                {/* Toolbar */}
                <div className="px-4 py-3 border-b border-zt-border flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zt-text-tertiary">{IconSearch}</span>
                    <input
                      type="text"
                      value={tabSearch}
                      onChange={(e) => setTabSearch(e.target.value)}
                      placeholder={tr("common.search") || "Suchen…"}
                      className="pl-7 pr-3 py-1.5 text-[12px] border border-zt-border rounded-lg bg-zt-bg-page w-[220px] text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary"
                    />
                  </div>
                  {flashMsg && (
                    <div className={`ml-auto rounded-lg border px-3 py-1 text-[12px] ${flashMsg.ok ? "border-zt-success-border bg-zt-success-light text-zt-success" : "border-zt-danger-border bg-zt-danger-light text-zt-danger"}`}>
                      {flashMsg.text}
                    </div>
                  )}
                </div>

                {/* ── Orders table ── */}
                {activeTab === "orders" && (
                  <>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-zt-bg-page">
                          <th className="px-4 py-2.5 text-left text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border whitespace-nowrap">{tr("orders.id")}</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border">{tr("orders.description")}</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border whitespace-nowrap">{tr("orders.status")}</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border whitespace-nowrap">{tr("orders.date")}</th>
                          <th className="px-4 py-2.5 text-center text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border whitespace-nowrap">{tr("orders.specimens")}</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border">{tr("orders.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordersLoading &&
                          Array.from({ length: 4 }, (_, i) => (
                            <tr key={`ord-skel-${i}`} className="border-b border-zt-border last:border-0">
                              {Array.from({ length: 6 }, (__, j) => (
                                <td key={j} className="px-4 py-3">
                                  <div className="h-4 rounded-md bg-zt-bg-muted animate-pulse" />
                                </td>
                              ))}
                            </tr>
                          ))}
                        {!ordersLoading && ordersError && (
                          <tr>
                            <td colSpan={6} className="px-4 py-4 text-[13px] text-zt-danger">
                              {tr("orders.loadError")}: {ordersError}
                            </td>
                          </tr>
                        )}
                        {!ordersLoading && !ordersError && visibleOrders.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-zt-text-tertiary">
                              {orders.length === 0 ? tr("orders.noResults") : tr("common.noData")}
                            </td>
                          </tr>
                        )}
                        {!ordersLoading && !ordersError &&
                          visibleOrders.map((o) => {
                            const meta = getOrderStatusMeta(o.status);
                            const isDeleting = deletingId === o.id;
                            return (
                              <tr
                                key={o.id}
                                className={`border-b border-zt-border last:border-0 hover:bg-zt-bg-page transition-colors ${isDeleting ? "opacity-40" : ""}`}
                              >
                                <td className="px-4 py-3 text-[11px] text-zt-text-tertiary font-mono whitespace-nowrap">
                                  {o.orderNumber || o.id}
                                </td>
                                <td className="px-4 py-3 text-[13px] text-zt-text-primary max-w-[220px] truncate" title={o.codeText}>
                                  {o.codeText || "–"}
                                </td>
                                <td className="px-4 py-3">
                                  <OrderStatusPill status={o.status} t={tr} />
                                </td>
                                <td className="px-4 py-3 text-[13px] text-zt-text-secondary whitespace-nowrap">
                                  {formatDate(o.authoredOn)}
                                </td>
                                <td className="px-4 py-3 text-center text-[12px] text-zt-text-secondary">
                                  {o.specimenCount || 0}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    {meta.editable ? (
                                      <Link
                                        href={`/order/${id}?sr=${o.id}`}
                                        className="inline-flex items-center gap-1 rounded-md border border-zt-primary-border bg-zt-primary-light px-2 py-0.5 text-[11px] text-zt-primary hover:opacity-80"
                                        title={tr("orders.edit")}
                                      >
                                        {tr("orders.edit")}
                                      </Link>
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-1 rounded-md border border-zt-border bg-zt-bg-muted px-2 py-0.5 text-[11px] text-zt-text-tertiary cursor-default"
                                        title={tr("orders.locked")}
                                      >
                                        {tr("orders.locked")}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => handleDeleteOrder(o.id)}
                                      disabled={isDeleting}
                                      title={tr("orders.delete")}
                                      className="inline-flex items-center rounded-md border border-zt-danger-border bg-zt-danger-light px-2 py-0.5 text-[11px] text-zt-danger hover:opacity-80 disabled:opacity-40"
                                    >
                                      {tr("orders.delete")}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                    {/* Add-order footer */}
                    <div className="px-4 py-3 border-t border-zt-border bg-zt-bg-page flex items-center gap-3">
                      <Link
                        href={`/order/${encodeURIComponent(id)}`}
                        className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-zt-primary text-zt-text-on-primary border border-zt-primary hover:opacity-90"
                      >
                        + {tr("home.order")}
                      </Link>
                      <span className="text-[12px] text-zt-text-tertiary ml-auto">
                        {ordersLoading ? "…" : `${orders.length} ${tr("orders.title")}`}
                      </span>
                    </div>
                  </>
                )}

                {/* ── Befunde table ── */}
                {activeTab === "befunde" && (
                  <>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-zt-bg-page">
                          <th className="px-4 py-2.5 text-left text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border">{tr("befunde.code")}</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border whitespace-nowrap">{tr("befunde.category")}</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border whitespace-nowrap">{tr("befunde.status")}</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border whitespace-nowrap">{tr("befunde.date")}</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border">{tr("befunde.result")}</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-[500] text-zt-text-tertiary uppercase tracking-wide border-b border-zt-border whitespace-nowrap">{tr("befunde.documents")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {befundeLoading &&
                          Array.from({ length: 4 }, (_, i) => (
                            <tr key={`bef-skel-${i}`} className="border-b border-zt-border last:border-0">
                              {Array.from({ length: 6 }, (__, j) => (
                                <td key={j} className="px-4 py-3">
                                  <div className="h-4 rounded-md bg-zt-bg-muted animate-pulse" />
                                </td>
                              ))}
                            </tr>
                          ))}
                        {!befundeLoading && befundeError && (
                          <tr>
                            <td colSpan={6} className="px-4 py-4 text-[13px] text-zt-danger">
                              {tr("befunde.loadError")}: {befundeError}
                            </td>
                          </tr>
                        )}
                        {!befundeLoading && !befundeError && visibleBefunde.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-zt-text-tertiary">
                              {filteredBefunde.length === 0 ? tr("befunde.noResults") : tr("common.noData")}
                            </td>
                          </tr>
                        )}
                        {!befundeLoading && !befundeError &&
                          visibleBefunde.map((b) => (
                            <tr
                              key={b.id}
                              className="border-b border-zt-border last:border-0 hover:bg-zt-bg-page transition-colors"
                            >
                              <td className="px-4 py-3 text-[13px] text-zt-text-primary max-w-[180px] truncate" title={b.codeText}>
                                {b.codeText || "–"}
                              </td>
                              <td className="px-4 py-3 text-[13px] text-zt-text-secondary whitespace-nowrap">
                                {b.category || "–"}
                              </td>
                              <td className="px-4 py-3">
                                <BefundStatusPill status={b.status} t={tr} />
                              </td>
                              <td className="px-4 py-3 text-[13px] text-zt-text-secondary whitespace-nowrap">
                                {formatDate(b.effectiveDate)}
                              </td>
                              <td className="px-4 py-3 text-[13px] text-zt-text-primary max-w-[200px]">
                                {b.conclusion ? (
                                  <span title={b.conclusion} className="block truncate">{b.conclusion}</span>
                                ) : (
                                  <span className="text-zt-text-tertiary">{b.resultCount} {tr("befunde.observations")}</span>
                                )}
                                {b.basedOn.length > 0 && (
                                  <div className="mt-0.5 flex flex-wrap gap-1">
                                    {b.basedOn.map((ref) => {
                                      const srId = ref.startsWith("ServiceRequest/") ? ref.slice("ServiceRequest/".length) : ref;
                                      return (
                                        <Link key={ref} href={`/order/${id}?sr=${srId}`} className="text-zt-primary hover:underline text-[11px]">
                                          {srId}
                                        </Link>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <PreviewButtons
                                  pdfData={b.pdfData} pdfTitle={b.pdfTitle || b.codeText}
                                  hl7Data={b.hl7Data} hl7Title={b.hl7Title || "HL7 ORU^R01"}
                                  onOpen={setModal}
                                />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-zt-border bg-zt-bg-page flex items-center justify-between">
                      <Link
                        href={`/patient/${encodeURIComponent(id)}/befunde`}
                        className="text-[12px] text-zt-primary hover:underline"
                      >
                        {tr("befunde.title")} → vollständige Ansicht
                      </Link>
                      <span className="text-[12px] text-zt-text-tertiary">
                        {befundeLoading ? "…" : `${filteredBefunde.length} ${tr("befunde.title")}`}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* JSON toggle */}
              <details className="mb-4">
                <summary className="text-[11px] text-zt-primary cursor-pointer hover:opacity-75 select-none">
                  Alle Daten (JSON) anzeigen
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-zt-border bg-zt-bg-page p-4 text-[11px] text-zt-text-secondary overflow-x-auto">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </details>
            </>
          );
        })()}
      </main>
    </div>
  );
}
