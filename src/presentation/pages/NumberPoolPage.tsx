"use client";

/**
 * NumberPoolPage — manage the pre-reserved order number pool.
 *
 * Sections:
 *   1. Stats summary (total / available / used per service type)
 *   2. Alert threshold configuration (infoAt / warnAt / errorAt)
 *   3. Add numbers form (bulk import, org picker, shared or org-specific)
 *   4. Pool entries table (filterable by type / status / org, deletable)
 */

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { useTranslation } from "@/lib/i18n";
import { useNumberPool }    from "@/presentation/hooks/useNumberPool";
import { useServiceTypes }  from "@/presentation/hooks/useServiceTypes";
import type { PoolThresholdDto } from "@/infrastructure/api/dto/NumberPoolDto";

interface FhirOrgResult { orgFhirId: string; orgGln: string; orgName: string; }

// ── StatsCard ──────────────────────────────────────────────────────────────────

function StatsCard({
  serviceType,
  total,
  available,
  used,
  t,
}: {
  serviceType: string;
  total:       number;
  available:   number;
  used:        number;
  t:           (k: string) => string;
}) {
  const pct = total > 0 ? Math.round((available / total) * 100) : 0;
  const colorClass =
    pct < 20 ? "text-zt-danger" :
    pct < 40 ? "text-zt-warning-text" :
    "text-zt-success";

  return (
    <div className="rounded-xl border border-zt-border bg-zt-bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-mono font-semibold text-zt-text-primary">{serviceType}</span>
        <span className={`text-[18px] font-semibold ${colorClass}`}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-zt-bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct < 20 ? "bg-zt-danger" : pct < 40 ? "bg-zt-warning" : "bg-zt-success"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-zt-text-tertiary">
        <span>{t("pool.available")}: <strong className="text-zt-text-primary">{available}</strong></span>
        <span>{t("pool.used")}: <strong className="text-zt-text-primary">{used}</strong></span>
        <span>{t("pool.total")}: <strong className="text-zt-text-primary">{total}</strong></span>
      </div>
    </div>
  );
}

// ── ThresholdForm ──────────────────────────────────────────────────────────────

function ThresholdForm({
  initial,
  onSave,
  t,
}: {
  initial: PoolThresholdDto;
  onSave:  (data: PoolThresholdDto) => Promise<void>;
  t:       (k: string) => string;
}) {
  const [form,  setForm]  = useState<PoolThresholdDto>(initial);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("pool.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  function handleChange(key: keyof PoolThresholdDto, value: string) {
    const num = parseInt(value, 10);
    if (!isNaN(num)) setForm((prev) => ({ ...prev, [key]: num }));
  }

  const numInput = (label: string, key: keyof PoolThresholdDto, color: string) => (
    <div>
      <label className={`block text-[11px] font-medium mb-1 ${color}`}>{label}</label>
      <input
        type="number"
        min={1}
        value={form[key]}
        onChange={(e) => handleChange(key, e.target.value)}
        className="w-full rounded-lg border border-zt-border bg-zt-bg-page px-3 py-1.5 text-[13px] text-zt-text-primary focus:outline-none focus:border-zt-primary"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="p-5 bg-zt-bg-card border border-zt-border rounded-xl space-y-4">
      <div className="text-[12px] text-zt-text-tertiary">{t("pool.thresholdHint")}</div>
      <div className="grid grid-cols-3 gap-4">
        {numInput(`Info ≥ ${form.infoAt}`,   "infoAt",  "text-zt-info")}
        {numInput(`Warn ≥ ${form.warnAt}`,   "warnAt",  "text-zt-warning-text")}
        {numInput(`Error ≥ ${form.errorAt}`, "errorAt", "text-zt-danger")}
      </div>
      {error && <div className="text-[12px] text-zt-danger">{error}</div>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-1.5 text-[13px] rounded-lg bg-zt-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {busy ? t("common.saving") : t("common.save")}
        </button>
        {saved && <span className="text-[12px] text-zt-success">{t("common.saved")}</span>}
      </div>
    </form>
  );
}

// ── OrgSearchField ─────────────────────────────────────────────────────────────

function OrgSearchField({
  onSelect,
  t,
}: {
  onSelect: (r: FhirOrgResult) => void;
  t:        (k: string) => string;
}) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<FhirOrgResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleChange = useCallback((q: string) => {
    setQuery(q);
    clearTimeout(debounce.current);
    if (q.length < 2) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/v1/proxy/fhir/organizations?q=${encodeURIComponent(q)}`);
        const data = await res.json() as { results: FhirOrgResult[] };
        setResults(data.results ?? []);
      } catch { setResults([]); }
      finally   { setLoading(false); }
    }, 350);
  }, []);

  function handleSelect(r: FhirOrgResult) {
    setQuery(r.orgName);
    setResults([]);
    onSelect(r);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    onSelect({ orgFhirId: "", orgGln: "", orgName: "" });
  }

  return (
    <div className="relative">
      <label className="block text-[11px] text-zt-text-tertiary mb-1">{t("pool.orgLabel")}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t("pool.orgSearchPlaceholder")}
          className="flex-1 rounded-lg border border-zt-border bg-zt-bg-page px-3 py-1.5 text-[13px] text-zt-text-primary focus:outline-none focus:border-zt-primary transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2 text-[11px] text-zt-text-tertiary hover:text-zt-danger transition-colors"
          >
            ✕
          </button>
        )}
      </div>
      {(results.length > 0 || loading) && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-zt-bg-card border border-zt-border rounded-lg shadow-lg overflow-hidden">
          {loading && <div className="px-3 py-2 text-[12px] text-zt-text-tertiary animate-pulse">…</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-zt-text-tertiary">{t("common.noResults")}</div>
          )}
          {results.map((r) => (
            <button
              key={r.orgFhirId}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 hover:bg-zt-bg-muted transition-colors border-b border-zt-border/40 last:border-0"
            >
              <div className="text-[13px] font-medium text-zt-text-primary">{r.orgName}</div>
              <div className="text-[11px] text-zt-text-tertiary font-mono">GLN {r.orgGln} · FHIR {r.orgFhirId}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AddNumbersForm ─────────────────────────────────────────────────────────────

function AddNumbersForm({
  onAdd,
  serviceTypes,
  t,
}: {
  onAdd:        (numbers: string[], serviceType: string, orgFhirId?: string | null) => Promise<{ added: number; skipped: number }>;
  serviceTypes: string[];
  t:            (k: string) => string;
}) {
  const [numbersText,  setNumbersText]  = useState("");
  const [serviceType,  setServiceType]  = useState<string>(serviceTypes[0] ?? "");
  const [isOrgSpecific, setIsOrgSpecific] = useState(false);
  const [selectedOrg,  setSelectedOrg]  = useState<FhirOrgResult | null>(null);
  const [busy,         setBusy]         = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [result,       setResult]       = useState<{ added: number; skipped: number } | null>(null);

  function handleOrgSelect(r: FhirOrgResult) {
    setSelectedOrg(r.orgFhirId ? r : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numbers = numbersText
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (numbers.length === 0) { setError(t("pool.noNumbers")); return; }
    if (isOrgSpecific && !selectedOrg) { setError(t("pool.orgRequired")); return; }

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const orgFhirId = isOrgSpecific ? (selectedOrg?.orgFhirId ?? null) : null;
      const res = await onAdd(numbers, serviceType, orgFhirId);
      setResult(res);
      setNumbersText("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("pool.addFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 bg-zt-bg-card border border-zt-border rounded-xl space-y-4">
      {/* Org mode toggle */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={!isOrgSpecific}
            onChange={() => setIsOrgSpecific(false)}
            className="accent-zt-primary"
          />
          <span className="text-[13px] text-zt-text-primary">{t("pool.orgShared")}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={isOrgSpecific}
            onChange={() => setIsOrgSpecific(true)}
            className="accent-zt-primary"
          />
          <span className="text-[13px] text-zt-text-primary">{t("pool.orgSpecific")}</span>
        </label>
      </div>

      {/* Org picker (visible when org-specific) */}
      {isOrgSpecific && (
        <div>
          <OrgSearchField onSelect={handleOrgSelect} t={t} />
          {selectedOrg && (
            <div className="mt-1.5 text-[11px] text-zt-text-tertiary font-mono">
              FHIR: {selectedOrg.orgFhirId} · GLN: {selectedOrg.orgGln}
            </div>
          )}
        </div>
      )}

      {/* Numbers + service type */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3">
          <label className="block text-[11px] text-zt-text-tertiary mb-1">{t("pool.numbersLabel")}</label>
          <textarea
            value={numbersText}
            onChange={(e) => setNumbersText(e.target.value)}
            rows={4}
            placeholder={"7004003000\n7004003001\n7004003002"}
            className="w-full rounded-lg border border-zt-border bg-zt-bg-page px-3 py-2 text-[12px] font-mono text-zt-text-primary focus:outline-none focus:border-zt-primary resize-none"
          />
          <div className="text-[11px] text-zt-text-tertiary mt-1">{t("pool.numbersHint")}</div>
        </div>
        <div>
          <label className="block text-[11px] text-zt-text-tertiary mb-1">{t("pool.serviceType")}</label>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as string)}
            className="w-full rounded-lg border border-zt-border bg-zt-bg-page px-3 py-1.5 text-[13px] text-zt-text-primary focus:outline-none focus:border-zt-primary"
          >
            {serviceTypes.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
      </div>

      {error  && <div className="text-[12px] text-zt-danger">{error}</div>}
      {result && (
        <div className="text-[12px] text-zt-success">
          {t("pool.addResult")
            .replace("{added}",   String(result.added))
            .replace("{skipped}", String(result.skipped))}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="px-4 py-1.5 text-[13px] rounded-lg bg-zt-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {busy ? t("common.saving") : t("pool.addBtn")}
      </button>
    </form>
  );
}

// ── NumberPoolPage ─────────────────────────────────────────────────────────────

export default function NumberPoolPage({ mode = "page" }: { mode?: "page" | "tab" }) {
  const { t } = useTranslation();
  const { serviceTypes } = useServiceTypes();
  const {
    entries, stats, thresholds, loading, error,
    addNumbers, deleteEntry, updateThresholds,
  } = useNumberPool();

  const [filterType,    setFilterType]    = useState<"ALL" | string>("ALL");
  const [filterStatus,  setFilterStatus]  = useState<"all" | "available" | "used">("all");
  const [filterOrg,     setFilterOrg]     = useState<"all" | "shared" | "org">("all");
  const [deleteError,   setDeleteError]   = useState<string | null>(null);

  const filtered = entries.filter((e) => {
    if (filterType !== "ALL" && e.serviceType !== filterType) return false;
    if (filterStatus === "available" && e.status !== "available") return false;
    if (filterStatus === "used"      && e.status !== "used")      return false;
    if (filterOrg === "shared" && e.orgFhirId) return false;
    if (filterOrg === "org"    && !e.orgFhirId) return false;
    return true;
  });

  async function handleDelete(id: string) {
    if (!confirm(t("pool.confirmDelete"))) return;
    setDeleteError(null);
    try {
      await deleteEntry(id);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : t("pool.deleteFailed"));
    }
  }

  const inner = (
    <div className={mode === "tab" ? "space-y-7 py-4" : "px-8 py-7 max-w-[1100px] mx-auto space-y-7"}>

      {mode === "page" && (
        <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary">
          <BackButton />
          <span>|</span>
          <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
          <span>/</span>
          <span className="text-zt-text-primary">{t("nav.adminNumberPool")}</span>
        </nav>
      )}

      {mode === "page" && (
        <div>
          <h1 className="text-[20px] font-medium text-zt-text-primary">{t("pool.title")}</h1>
          <p className="text-[13px] text-zt-text-tertiary mt-0.5">{t("pool.subtitle")}</p>
        </div>
      )}

      {/* Loading */}
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-20 rounded-xl bg-zt-bg-card animate-pulse" />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-xl border border-zt-danger-border bg-zt-danger-light px-5 py-4 text-[13px] text-zt-danger">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {serviceTypes.map((st) => {
                  const s = stats[st] ?? { total: 0, available: 0, used: 0 };
                  return (
                    <StatsCard
                      key={st}
                      serviceType={st}
                      total={s.total}
                      available={s.available}
                      used={s.used}
                      t={t}
                    />
                  );
                })}
              </div>

              {/* Threshold config */}
              <div>
                <h2 className="text-[14px] font-medium text-zt-text-primary mb-3">{t("pool.thresholdsTitle")}</h2>
                {thresholds && (
                  <ThresholdForm initial={thresholds} onSave={updateThresholds} t={t} />
                )}
              </div>

              {/* Add numbers */}
              <div>
                <h2 className="text-[14px] font-medium text-zt-text-primary mb-3">{t("pool.addTitle")}</h2>
                <AddNumbersForm onAdd={addNumbers} serviceTypes={serviceTypes} t={t} />
              </div>

              {/* Pool table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[14px] font-medium text-zt-text-primary">{t("pool.tableTitle")}</h2>
                  <div className="flex items-center gap-2">
                    {/* Service type filter */}
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as "ALL" | string)}
                      className="rounded-lg border border-zt-border bg-zt-bg-page px-2 py-1 text-[12px] text-zt-text-primary focus:outline-none"
                    >
                      <option value="ALL">{t("common.all")}</option>
                      {serviceTypes.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                    {/* Status filter */}
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as "all" | "available" | "used")}
                      className="rounded-lg border border-zt-border bg-zt-bg-page px-2 py-1 text-[12px] text-zt-text-primary focus:outline-none"
                    >
                      <option value="all">{t("common.all")}</option>
                      <option value="available">{t("pool.available")}</option>
                      <option value="used">{t("pool.used")}</option>
                    </select>
                    {/* Org filter */}
                    <select
                      value={filterOrg}
                      onChange={(e) => setFilterOrg(e.target.value as "all" | "shared" | "org")}
                      className="rounded-lg border border-zt-border bg-zt-bg-page px-2 py-1 text-[12px] text-zt-text-primary focus:outline-none"
                    >
                      <option value="all">{t("common.all")}</option>
                      <option value="shared">{t("pool.shared")}</option>
                      <option value="org">{t("pool.orgSpecific")}</option>
                    </select>
                  </div>
                </div>

                {deleteError && (
                  <div className="mb-3 rounded border border-zt-danger-border bg-zt-danger-light px-4 py-2 text-[12px] text-zt-danger">
                    {deleteError}
                  </div>
                )}

                <div className="rounded-xl border border-zt-border overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-zt-border bg-zt-bg-card">
                        <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium">{t("pool.number")}</th>
                        <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium">{t("pool.serviceType")}</th>
                        <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium">{t("pool.org")}</th>
                        <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium">{t("pool.status")}</th>
                        <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium">{t("pool.usedFor")}</th>
                        <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-[13px] text-zt-text-tertiary">
                            {t("pool.empty")}
                          </td>
                        </tr>
                      )}
                      {filtered.map((entry) => (
                        <tr key={entry.id} className="border-b border-zt-border/50 last:border-0 hover:bg-zt-bg-page transition-colors">
                          <td className="px-4 py-3 text-[12px] font-mono text-zt-text-primary">{entry.number}</td>
                          <td className="px-4 py-3 text-[12px] font-mono text-zt-text-secondary">{entry.serviceType}</td>
                          <td className="px-4 py-3 text-[11px] font-mono text-zt-text-secondary">
                            {entry.orgFhirId ? (
                              <span className="px-1.5 py-0.5 rounded bg-zt-info-light text-zt-info border border-zt-info-border">
                                {entry.orgFhirId}
                              </span>
                            ) : (
                              <span className="text-zt-text-tertiary italic">{t("pool.shared")}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                              entry.status === "available"
                                ? "bg-zt-success-light text-zt-success border border-zt-success-border"
                                : "bg-zt-bg-muted text-zt-text-tertiary border border-zt-border"
                            }`}>
                              {entry.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] font-mono text-zt-text-tertiary">
                            {entry.usedForPatientId || "—"}
                          </td>
                          <td className="px-4 py-3">
                            {entry.status === "available" && (
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="px-2.5 py-1 text-[11px] rounded border border-zt-danger-border text-zt-danger hover:bg-zt-danger-light transition-colors"
                              >
                                {t("common.delete")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

    </div>
  );

  if (mode === "tab") return inner;

  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />
      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        {inner}
      </div>
    </div>
  );
}
