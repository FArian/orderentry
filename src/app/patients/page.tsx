"use client";

import type React from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { formatReadableDate } from "@/shared/utils/formatDate";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterMode = "active" | "inactive" | "all";

interface Patient {
  id:        string;
  name:      string;
  address:   string;
  updatedAt: string;
  active:    boolean;
  /** Display name of managingOrganization (Sender). Never fetched per-row from FHIR. */
  senderName?: string | undefined;
}

// ── FHIR Patient parsing ──────────────────────────────────────────────────────

interface FhirHumanName { text?: string; given?: string[]; family?: string }
interface FhirAddress   { text?: string; line?: string[]; city?: string; postalCode?: string; country?: string }
interface FhirPatientResource {
  resourceType: "Patient";
  id?:          string;
  active?:      boolean;
  name?:        FhirHumanName[];
  address?:     FhirAddress[];
  meta?:        { lastUpdated?: string };
  managingOrganization?: { display?: string; reference?: string };
}

function fhirNameToString(n?: FhirHumanName[]): string {
  if (!n || n.length === 0) return "Unknown";
  const first = n[0];
  if (!first) return "Unknown";
  if (first.text?.trim()) return first.text.trim();
  return [...(first.given ?? []), first.family ?? ""].filter(Boolean).join(" ") || "Unknown";
}

function fhirAddressToString(a?: FhirAddress[]): string {
  if (!a || a.length === 0) return "";
  const first = a[0];
  if (!first) return "";
  if (first.text?.trim()) return first.text.trim();
  return [...(first.line ?? []), first.city, first.postalCode, first.country].filter(Boolean).join(", ");
}

function mapFhirPatient(r: FhirPatientResource): Patient {
  return {
    id:         r.id ?? "",
    name:       fhirNameToString(r.name),
    address:    fhirAddressToString(r.address),
    updatedAt:  r.meta?.lastUpdated ?? "",
    // FHIR spec: absent active field means active=true
    active:     r.active ?? true,
    ...(r.managingOrganization?.display ? { senderName: r.managingOrganization.display } : {}),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const truncate = (text: string, max: number) =>
  text && text.length > max ? `${text.slice(0, max)}…` : text;

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-zt-primary-light text-zt-primary",
  "bg-[#FBEAF0] text-[#993556]",
  "bg-[#E1F5EE] text-[#0F6E56]",
  "bg-[#FAEEDA] text-[#854F0B]",
];
function avatarColor(idx: number): string {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length]!;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterTabs({
  mode,
  onChange,
}: {
  mode:     FilterMode;
  onChange: (m: FilterMode) => void;
}) {
  const { t } = useTranslation();
  const tabs: { id: FilterMode; label: string }[] = [
    { id: "active",   label: t("patient.statusActive") },
    { id: "inactive", label: t("patient.statusInactive") },
    { id: "all",      label: t("patient.statusAll") },
  ];
  return (
    <div className="flex items-center rounded-[8px] border border-zt-border bg-zt-bg-page p-0.5 gap-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`text-[12px] px-3 py-1 rounded-[6px] font-medium transition-colors cursor-pointer ${
            mode === tab.id
              ? "bg-zt-bg-card text-zt-primary shadow-sm border border-zt-border"
              : "text-zt-text-secondary hover:text-zt-text-primary"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  const { t } = useTranslation();
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zt-success-light text-zt-success border border-zt-success-border whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-zt-success" aria-hidden="true" />
        {t("patient.statusActive")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zt-bg-muted text-zt-text-secondary border border-zt-border whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-zt-text-tertiary" aria-hidden="true" />
      {t("patient.statusInactive")}
    </span>
  );
}

function CountLabel({ total, mode, loading }: { total: number; mode: FilterMode; loading: boolean }) {
  const { t } = useTranslation();
  if (loading) return <span className="text-[12px] text-zt-text-tertiary">{t("common.loading")}</span>;
  const key = mode === "active"   ? "patient.showingActive"
            : mode === "inactive" ? "patient.showingInactive"
            : "patient.showingAll";
  return (
    <span className="text-[12px] text-zt-text-tertiary">
      {t(key).replace("{n}", String(total))}
    </span>
  );
}

function Pagination({
  page, totalPages, loading, onPage,
}: {
  page: number; totalPages: number; loading: boolean; onPage: (p: number) => void;
}) {
  const pageNums = useMemo(() => {
    if (totalPages <= 1) return [] as number[];
    const w = 5;
    let start = Math.max(1, page - Math.floor(w / 2));
    let end = start + w - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - w + 1); }
    const arr: number[] = [];
    for (let n = start; n <= end; n++) arr.push(n);
    return arr;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <PageBtn label="«" disabled={page <= 1 || loading} onClick={() => onPage(1)} />
      <PageBtn label="‹" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)} />
      {(pageNums[0] ?? 1) > 1 && <span className="px-1 text-xs text-zt-text-tertiary">…</span>}
      {pageNums.map((n) => (
        <button
          key={n}
          onClick={() => onPage(n)}
          disabled={loading}
          className={`w-7 h-7 rounded-[7px] border text-xs flex items-center justify-center transition-colors cursor-pointer ${
            n === page
              ? "bg-zt-primary text-zt-text-on-primary border-zt-primary"
              : "bg-zt-bg-card border-zt-border text-zt-text-secondary hover:bg-zt-bg-page"
          }`}
        >
          {n}
        </button>
      ))}
      {(pageNums[pageNums.length - 1] ?? totalPages) < totalPages && (
        <span className="px-1 text-xs text-zt-text-tertiary">…</span>
      )}
      <PageBtn label="›" disabled={page >= totalPages || loading} onClick={() => onPage(page + 1)} />
      <PageBtn label="»" disabled={page >= totalPages || loading} onClick={() => onPage(totalPages)} />
    </div>
  );
}

function PageBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded-[7px] border border-zt-border bg-zt-bg-card text-xs text-zt-text-secondary flex items-center justify-center hover:bg-zt-bg-page disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
    >
      {label}
    </button>
  );
}

// ── Column count helper ───────────────────────────────────────────────────────
// Name | Status | Sender | Address | Updated | Orders | Actions  = 7
// +1 for merge checkbox = 8

function colCount(mergeMode: boolean) {
  return mergeMode ? 8 : 7;
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ mergeMode }: { mergeMode: boolean }) {
  return (
    <tr className="border-b border-zt-border/50 last:border-b-0 animate-pulse">
      {mergeMode && <td className="px-4 py-3.5 w-10" />}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zt-bg-muted shrink-0" />
          <div>
            <div className="h-3 w-36 bg-zt-bg-muted rounded mb-1.5" />
            <div className="h-2.5 w-20 bg-zt-bg-muted rounded" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5"><div className="h-5 w-14 bg-zt-bg-muted rounded-full" /></td>
      <td className="px-4 py-3.5"><div className="h-5 w-28 bg-zt-bg-muted rounded-md" /></td>
      <td className="px-4 py-3.5"><div className="h-3 w-48 bg-zt-bg-muted rounded" /></td>
      <td className="px-4 py-3.5"><div className="h-3 w-24 bg-zt-bg-muted rounded" /></td>
      <td className="px-4 py-3.5"><div className="h-5 w-16 bg-zt-bg-muted rounded-full" /></td>
      <td className="px-4 py-3.5">
        <div className="flex gap-1.5">
          <div className="h-6 w-16 bg-zt-bg-muted rounded-lg" />
          <div className="h-6 w-16 bg-zt-bg-muted rounded-lg" />
        </div>
      </td>
    </tr>
  );
}

// ── Patient row ───────────────────────────────────────────────────────────────

function PatientRow({
  patient,
  idx,
  mergeMode,
  isSelected,
  selIdx,
  activatingId,
  canActivate,
  t,
  onRowClick,
  onMergeToggle,
  onSetActive,
}: {
  patient:      Patient;
  idx:          number;
  mergeMode:    boolean;
  isSelected:   boolean;
  selIdx:       number;
  activatingId: string | null;
  canActivate:  boolean;
  t:            (k: string) => string;
  onRowClick:   () => void;
  onMergeToggle: () => void;
  onSetActive:  (active: boolean) => void;
}) {
  const readableDate = formatReadableDate(patient.updatedAt);

  return (
    <tr
      className={`border-b border-zt-border/50 last:border-b-0 cursor-pointer transition-colors group ${
        mergeMode
          ? isSelected
            ? "bg-[#FAEEDA] hover:bg-[#FAE0C0]"
            : "hover:bg-zt-bg-page"
          : "hover:bg-zt-bg-page"
      }`}
      onClick={onRowClick}
    >
      {/* Merge checkbox */}
      {mergeMode && (
        <td className="px-4 py-3.5 w-10" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onMergeToggle}
            disabled={!isSelected && selIdx < 0 && false /* handled by parent */}
            className="cursor-pointer accent-zt-primary"
          />
          {isSelected && (
            <span className="ml-1 text-xs font-bold text-[#854F0B]">
              {selIdx === 0 ? "→" : "×"}
            </span>
          )}
        </td>
      )}

      {/* Name + avatar */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${avatarColor(idx)}`}
            aria-hidden="true"
          >
            {nameInitials(patient.name)}
          </div>
          <div>
            <div className="text-[13px] font-medium text-zt-text-primary group-hover:text-zt-primary transition-colors">
              {truncate(patient.name, 30)}
            </div>
            <div className="text-[11px] text-zt-text-tertiary mt-0.5 font-mono">
              {patient.id}
            </div>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        <StatusBadge active={patient.active} />
      </td>

      {/* Sender (managingOrganization) */}
      <td className="px-4 py-3.5">
        {patient.senderName
          ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-zt-primary-border bg-zt-primary-light text-zt-primary text-[12px] font-medium whitespace-nowrap max-w-[160px] truncate" title={patient.senderName}>
              {patient.senderName}
            </span>
          )
          : <span className="text-zt-text-tertiary text-[12px]">—</span>
        }
      </td>

      {/* Address */}
      <td className="px-4 py-3.5 max-w-[220px]">
        {patient.address
          ? <span className="text-[13px] text-zt-text-secondary truncate block" title={patient.address}>{truncate(patient.address, 36)}</span>
          : <span className="text-[12px] text-zt-text-tertiary italic">{t("patient.noAddress")}</span>
        }
      </td>

      {/* Last updated */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        {readableDate
          ? <span className="text-[12px] text-zt-text-secondary">{readableDate}</span>
          : <span className="text-[12px] text-zt-text-tertiary">—</span>
        }
      </td>

      {/* Orders placeholder — count not available from list endpoint */}
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1 text-[11px] text-zt-text-tertiary bg-zt-bg-page px-2 py-0.5 rounded-full border border-zt-border">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
            <rect x="1" y="1" width="8" height="8" rx="1"/>
          </svg>
          {t("orders.title")}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          {patient.active ? (
            <>
              {/* Aufträge */}
              <Link
                href={`/patient/${encodeURIComponent(patient.id)}`}
                title={t("orders.title")}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-zt-primary-light text-zt-primary border border-zt-primary-border hover:bg-zt-primary hover:text-zt-text-on-primary transition-colors whitespace-nowrap"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                  <rect x="1" y="1" width="8" height="9" rx="0.8"/>
                  <path d="M3 4h4M3 6h2.5" stroke="white" strokeWidth="0.9" strokeLinecap="round" fill="none"/>
                </svg>
                {t("orders.title")}
              </Link>

              {/* Befunde */}
              <Link
                href={`/patient/${encodeURIComponent(patient.id)}/befunde`}
                title={t("befunde.title")}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-zt-success-light text-zt-success border border-zt-success-border hover:bg-zt-success hover:text-zt-text-on-success transition-colors whitespace-nowrap"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2 5.5l2 2L8 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t("befunde.title")}
              </Link>

              {/* Deactivate — only for users with patient:activate */}
              {canActivate && (
                <button
                  onClick={() => onSetActive(false)}
                  disabled={activatingId === patient.id}
                  title={t("patient.deactivate")}
                  className="w-7 h-7 rounded-[6px] border border-zt-border bg-zt-bg-card flex items-center justify-center hover:bg-zt-danger-light hover:border-zt-danger hover:text-zt-danger disabled:opacity-50 transition-colors cursor-pointer"
                  aria-label={t("patient.deactivate")}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
              )}

              {/* Detail arrow */}
              <Link
                href={`/patient/${encodeURIComponent(patient.id)}`}
                title={t("common.edit")}
                className="w-7 h-7 rounded-[6px] border border-zt-border bg-zt-bg-card flex items-center justify-center hover:bg-zt-bg-page hover:border-zt-primary transition-colors"
                aria-label={t("common.edit")}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M4 3l3 2.5L4 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </>
          ) : (
            /* Inactive patient — show activate button */
            canActivate ? (
              <button
                onClick={() => onSetActive(true)}
                disabled={activatingId === patient.id}
                title={t("patient.activate")}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-zt-success-light text-zt-success border border-zt-success-border hover:bg-zt-success hover:text-zt-text-on-success disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M2 5.5l2.5 2.5L9 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {activatingId === patient.id ? t("common.saving") : t("patient.activate")}
              </button>
            ) : (
              <span className="text-[11px] text-zt-text-tertiary italic">{t("patient.statusInactive")}</span>
            )
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main page content ─────────────────────────────────────────────────────────

function PatientPageContent() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const { t }       = useTranslation();

  const [query,      setQuery]      = useState("");
  const [items,      setItems]      = useState<Patient[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [page,       setPage]       = useState(1);
  const pageSize                    = 20;
  const [total,      setTotal]      = useState(0);
  const [filterMode, setFilterMode] = useState<FilterMode>("active");

  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateMsg,  setActivateMsg]  = useState<string | null>(null);
  const [canActivate,  setCanActivate]  = useState(false);

  const [mergeMode,     setMergeMode]     = useState(false);
  const [mergeSelected, setMergeSelected] = useState<Patient[]>([]);
  const [merging,       setMerging]       = useState(false);
  const [mergeMsg,      setMergeMsg]      = useState<string | null>(null);
  const [mergeErr,      setMergeErr]      = useState<string | null>(null);

  const debounceRef    = useRef<number | undefined>(undefined);
  const initializedRef = useRef(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchPatients = useCallback(async (q: string, p: number, mode: FilterMode = "active") => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ q, page: String(p), pageSize: String(pageSize) });
      if (mode === "inactive") params.set("showInactive", "true");
      if (mode === "all")      params.set("showAll", "true");
      const res = await fetch(`/api/patients?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const bundle = await res.json() as { total?: number; entry?: Array<{ resource?: FhirPatientResource }> };
      const patients = (bundle.entry ?? [])
        .map((e) => e.resource)
        .filter((r): r is FhirPatientResource => !!r && !!r.id)
        .map(mapFhirPatient);
      setItems(patients);
      setTotal(bundle.total ?? patients.length);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("patient.loadError"));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const initialQ = (searchParams?.get("q") || "").toString();
    setQuery(initialQ);
    fetchPatients(initialQ, 1, "active");
    // Check if the current user has patient:activate permission
    fetch("/api/v1/me/permissions")
      .then((r) => r.json() as Promise<{ permissions?: string[] }>)
      .then((d) => { setCanActivate((d.permissions ?? []).includes("patient:activate")); })
      .catch(() => { /* stay false */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initializedRef.current) { initializedRef.current = true; return; }
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setPage(1);
      const q = query.trim();
      router.replace(q ? `/patients?q=${encodeURIComponent(q)}` : "/patients", { scroll: false });
      fetchPatients(q, 1, filterMode);
    }, 400);
    return () => { window.clearTimeout(debounceRef.current); };
  }, [query, fetchPatients, router, filterMode]);

  function goPage(p: number) {
    setPage(p);
    fetchPatients(query.trim(), p, filterMode);
  }

  function applyFilter(mode: FilterMode) {
    setFilterMode(mode);
    setPage(1);
    fetchPatients(query.trim(), 1, mode);
  }

  // ── Merge ────────────────────────────────────────────────────────────────────

  function toggleMergeSelect(patient: Patient) {
    setMergeSelected((prev) => {
      const already = prev.find((p) => p.id === patient.id);
      if (already) return prev.filter((p) => p.id !== patient.id);
      if (prev.length >= 2) return prev;
      return [...prev, patient];
    });
  }

  async function executeMerge() {
    if (mergeSelected.length !== 2) return;
    setMerging(true);
    setMergeMsg(null);
    setMergeErr(null);
    const [target, source] = mergeSelected as [Patient, Patient];
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(target.id)}/merge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: source.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || String(res.status));
      setMergeMsg(t("patient.mergeOk"));
      setMergeSelected([]);
      setMergeMode(false);
      fetchPatients(query, page, filterMode);
    } catch (e: unknown) {
      setMergeErr(e instanceof Error ? e.message : String(e));
    } finally {
      setMerging(false);
    }
  }

  async function setPatientActive(patientId: string, active: boolean) {
    setActivatingId(patientId);
    setActivateMsg(null);
    try {
      const res = await fetch(`/api/v1/patients/${encodeURIComponent(patientId)}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ active }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? String(res.status));
      setActivateMsg(active ? t("patient.activateOk") : t("patient.deactivateOk"));
      fetchPatients(query, page, filterMode);
    } catch (e: unknown) {
      setActivateMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setActivatingId(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const cols = colCount(mergeMode);

  return (
    <div className="flex overflow-hidden" style={{ height: "calc(100vh - var(--zt-topbar-height))" }}>
      <AppSidebar />

      <div className="flex-1 overflow-y-auto px-8 py-7">

        {/* Breadcrumb */}
        <nav className="mb-3.5 flex items-center gap-1.5 text-xs text-zt-text-tertiary" aria-label="Brotkrumen">
          <BackButton />
          <span>|</span>
          <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
          <span>/</span>
          <span className="text-zt-text-primary">{t("patient.title")}</span>
        </nav>

        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-medium text-zt-text-primary">{t("patient.title")}</h1>
          <div className="flex items-center gap-2">
            {/* Merge toggle — only in active/all mode */}
            {filterMode !== "inactive" && (
              <button
                type="button"
                onClick={() => { setMergeMode((m) => !m); setMergeSelected([]); setMergeMsg(null); setMergeErr(null); }}
                className={`h-8 flex items-center gap-1.5 px-3 rounded-[8px] border text-[13px] transition-colors cursor-pointer ${
                  mergeMode
                    ? "bg-[#FAEEDA] text-[#854F0B] border-[#FAC775]"
                    : "border-zt-border bg-zt-bg-card text-zt-text-primary hover:bg-zt-bg-page"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <circle cx="4.5" cy="4.5" r="3" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 7l3 3" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
                {mergeMode ? t("patient.mergeModeOn") : t("patient.mergeMode")}
              </button>
            )}

            <Link
              href="/patients"
              className="h-8 flex items-center gap-1.5 px-3 rounded-[8px] bg-zt-primary text-[13px] font-medium text-zt-text-on-primary hover:bg-zt-primary-hover transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <rect x="0.5" y="0.5" width="11" height="11" rx="1.5" stroke="white" strokeWidth="1"/>
                <path d="M4 6h4M6 4v4" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {t("dashboard.newOrder")}
            </Link>
          </div>
        </div>

        {/* Merge banner */}
        {mergeMode && (
          <div className="mb-4 flex flex-col gap-1.5 rounded-xl border border-[#FAC775] bg-[#FAEEDA] px-4 py-3 text-sm text-[#854F0B]">
            <p className="font-medium">{t("patient.mergeHint")}</p>
            {mergeSelected.length === 0 && (
              <p className="text-xs">{t("patient.mergeSelectFirst")}</p>
            )}
            {mergeSelected.length === 1 && (
              <p className="text-xs">→ <strong>{mergeSelected[0]!.name}</strong> {t("patient.mergeSelectSecond")}</p>
            )}
            {mergeSelected.length === 2 && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs">
                  <strong>{mergeSelected[1]!.name}</strong> → <strong>{mergeSelected[0]!.name}</strong>
                </span>
                <button
                  onClick={executeMerge}
                  disabled={merging}
                  className="px-3 py-1 rounded-[7px] bg-[#854F0B] text-white text-xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {merging ? t("common.saving") : t("patient.mergeConfirm")}
                </button>
                <button
                  onClick={() => setMergeSelected([])}
                  className="px-3 py-1 rounded-[7px] bg-zt-bg-card border border-zt-border text-xs text-zt-text-primary hover:bg-zt-bg-page cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
            {mergeMsg && <p className="text-xs text-zt-success">{mergeMsg}</p>}
            {mergeErr && <p className="text-xs text-zt-danger">{mergeErr}</p>}
          </div>
        )}

        {/* Activate feedback */}
        {activateMsg && (
          <div className="mb-4 rounded-xl border border-zt-success-border bg-zt-success-light px-4 py-2.5 text-sm text-zt-success">
            {activateMsg}
          </div>
        )}

        {/* Toolbar: search + filter tabs + count */}
        <div className="flex items-center gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-[340px]">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zt-text-tertiary pointer-events-none"
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
            >
              <circle cx="5.5" cy="5.5" r="4"/>
              <path d="M9 9l3 3"/>
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  window.clearTimeout(debounceRef.current);
                  fetchPatients(query.trim(), 1, filterMode);
                }
              }}
              placeholder={t("patient.searchPlaceholder")}
              className="w-full pl-9 pr-3 py-[7px] rounded-[8px] border border-zt-border bg-zt-bg-card text-[13px] text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary transition-colors"
            />
          </div>

          {/* Filter tabs */}
          <FilterTabs mode={filterMode} onChange={applyFilter} />

          {/* Count — right aligned */}
          <div className="ml-auto">
            <CountLabel total={total} mode={filterMode} loading={loading} />
          </div>
        </div>

        {/* Table */}
        <div className="bg-zt-bg-card border border-zt-border rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-zt-bg-page">
                {mergeMode && (
                  <th className="w-10 px-4 py-2.5 border-b border-zt-border" />
                )}
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zt-text-secondary uppercase tracking-[0.05em] border-b border-zt-border whitespace-nowrap">
                  {t("patient.name")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zt-text-secondary uppercase tracking-[0.05em] border-b border-zt-border whitespace-nowrap">
                  {t("patient.colStatus")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zt-text-secondary uppercase tracking-[0.05em] border-b border-zt-border whitespace-nowrap">
                  {t("org.sender")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zt-text-secondary uppercase tracking-[0.05em] border-b border-zt-border">
                  {t("patient.address")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zt-text-secondary uppercase tracking-[0.05em] border-b border-zt-border whitespace-nowrap">
                  {t("patient.lastUpdated")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zt-text-secondary uppercase tracking-[0.05em] border-b border-zt-border">
                  {t("orders.title")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zt-text-secondary uppercase tracking-[0.05em] border-b border-zt-border">
                  {t("orders.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Skeleton */}
              {loading && Array.from({ length: 8 }, (_, i) => (
                <SkeletonRow key={`sk-${i}`} mergeMode={mergeMode} />
              ))}

              {/* Error */}
              {!loading && error && (
                <tr>
                  <td colSpan={cols} className="px-4 py-8 text-center text-sm text-zt-danger">
                    {error}
                  </td>
                </tr>
              )}

              {/* Empty */}
              {!loading && !error && items.length === 0 && (
                <tr>
                  <td colSpan={cols} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-zt-text-tertiary opacity-40" aria-hidden="true">
                        <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M22 22l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span className="text-[13px] text-zt-text-tertiary">{t("patient.noResults")}</span>
                    </div>
                  </td>
                </tr>
              )}

              {/* Patient rows */}
              {!loading && !error && items.map((patient, idx) => {
                const isSelected = mergeSelected.some((p) => p.id === patient.id);
                const selIdx     = mergeSelected.findIndex((p) => p.id === patient.id);
                return (
                  <PatientRow
                    key={patient.id}
                    patient={patient}
                    idx={idx}
                    mergeMode={mergeMode}
                    isSelected={isSelected}
                    selIdx={selIdx}
                    activatingId={activatingId}
                    canActivate={canActivate}
                    t={t}
                    onRowClick={() => {
                      if (mergeMode) toggleMergeSelect(patient);
                      else window.location.href = `/patient/${encodeURIComponent(patient.id)}`;
                    }}
                    onMergeToggle={() => toggleMergeSelect(patient)}
                    onSetActive={(active) => setPatientActive(patient.id, active)}
                  />
                );
              })}
            </tbody>
          </table>

          {/* Table footer */}
          {!loading && total > pageSize && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zt-border bg-zt-bg-page">
              <span className="text-xs text-zt-text-tertiary">
                {t("patient.showing")} {from}–{to} {t("patient.of")} {total}
              </span>
              <Pagination page={page} totalPages={totalPages} loading={loading} onPage={goPage} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  return (
    <Suspense fallback={
      <div
        className="flex items-center justify-center text-sm text-zt-text-tertiary"
        style={{ height: "calc(100vh - var(--zt-topbar-height))" }}
      >
        …
      </div>
    }>
      <PatientPageContent />
    </Suspense>
  );
}
