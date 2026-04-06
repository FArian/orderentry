"use client";

/**
 * OrgRulesPage — CRUD administration for organisation-specific rules.
 *
 * Features:
 * - FHIR organisation search (GLN or name) → auto-fills orgFhirId / orgGln / orgName
 * - Per-org order number overrides (MIBI prefix/start/length, POC prefix/length, Routine length)
 * - Service type mapping editor (department code → MIBI | ROUTINE | POC)
 * - HL7 MSH segment configuration
 */

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { useTranslation } from "@/lib/i18n";
import { useOrgRules }      from "@/presentation/hooks/useOrgRules";
import { useServiceTypes }  from "@/presentation/hooks/useServiceTypes";
import type { OrgRuleDto }  from "@/infrastructure/api/dto/OrgRuleDto";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FhirOrgResult { orgFhirId: string; orgGln: string; orgName: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyRule(): Partial<OrgRuleDto> {
  return {
    orgFhirId: "", orgGln: "", orgName: "",
    patientPrefix: "", casePrefix: "",
    hl7Msh3: "", hl7Msh4: "", hl7Msh5: "", hl7Msh6: "",
    mibiPrefix: "", mibiStart: "", mibiLength: null,
    pocPrefix: "", pocLength: null, routineLength: null,
    serviceTypeMapping: {},
  };
}

// ── OrgSearchField ─────────────────────────────────────────────────────────────

function OrgSearchField({
  onSelect,
  t,
}: {
  onSelect: (r: FhirOrgResult) => void;
  t: (k: string) => string;
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
        const res = await fetch(`/api/v1/proxy/fhir/organizations?q=${encodeURIComponent(q)}`);
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

  return (
    <div className="relative col-span-2">
      <label className="block text-[11px] text-zt-text-tertiary mb-1">{t("orgRules.searchOrg")}</label>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t("orgRules.searchPlaceholder")}
        className="w-full rounded-lg border border-zt-border bg-zt-bg-page px-3 py-1.5 text-[13px] text-zt-text-primary focus:outline-none focus:border-zt-primary transition-colors"
      />
      <p className="text-[11px] text-zt-text-tertiary mt-0.5">{t("orgRules.searchHint")}</p>
      {(results.length > 0 || loading) && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-zt-bg-card border border-zt-border rounded-lg shadow-lg overflow-hidden">
          {loading && <div className="px-3 py-2 text-[12px] text-zt-text-tertiary animate-pulse">…</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-zt-text-tertiary">{t("orgRules.noResults")}</div>
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

// ── MappingEditor ─────────────────────────────────────────────────────────────

function MappingEditor({
  value,
  onChange,
  serviceTypes,
  t,
}: {
  value:        Record<string, string>;
  onChange:     (v: Record<string, string>) => void;
  serviceTypes: string[];
  t:            (k: string) => string;
}) {
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState<string>(serviceTypes[0] ?? "");

  function handleAdd() {
    const k = newKey.trim().toUpperCase();
    if (!k) return;
    onChange({ ...value, [k]: newVal });
    setNewKey("");
  }

  function handleRemove(k: string) {
    const next = { ...value };
    delete next[k];
    onChange(next);
  }

  return (
    <div className="col-span-2 space-y-2">
      <label className="block text-[11px] text-zt-text-tertiary">{t("orgRules.mappingTitle")}</label>
      <p className="text-[11px] text-zt-text-tertiary">{t("orgRules.mappingHint")}</p>

      {Object.keys(value).length === 0 && (
        <p className="text-[11px] text-zt-text-tertiary italic">{t("orgRules.mappingEmpty")}</p>
      )}

      <div className="space-y-1">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="flex-1 text-[12px] font-mono bg-zt-bg-page border border-zt-border rounded px-2 py-1">{k}</span>
            <span className="text-zt-text-tertiary">→</span>
            <span className="w-24 text-[12px] font-mono bg-zt-bg-page border border-zt-border rounded px-2 py-1 text-zt-primary">{v}</span>
            <button
              type="button"
              onClick={() => handleRemove(k)}
              className="text-zt-danger text-[11px] hover:underline"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder={t("orgRules.mappingAddKey")}
          className="flex-1 rounded border border-zt-border bg-zt-bg-page px-2 py-1 text-[12px] font-mono focus:outline-none focus:border-zt-primary"
        />
        <select
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          className="w-28 rounded border border-zt-border bg-zt-bg-page px-2 py-1 text-[12px] focus:outline-none"
        >
          {serviceTypes.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-1 text-[12px] rounded bg-zt-primary text-white hover:opacity-90"
        >
          {t("orgRules.mappingAdd")}
        </button>
      </div>
    </div>
  );
}

// ── NumberConfigEditor ────────────────────────────────────────────────────────


interface NumberConfigRow {
  serviceType: string;  // dynamic — from FHIR or ENV
  prefix:      string;  // not applicable for ROUTINE (purely numeric)
  start:       string;  // only for MIBI (start digit after prefix)
  length:      string;  // "" = use global default
}

/** Case-insensitive DB-column mapper (MIBI/POC/ROUTINE have dedicated columns). */
function normalise(st: string) { return st.toUpperCase(); }

function toConfigRows(form: Partial<OrgRuleDto>): NumberConfigRow[] {
  const rows: NumberConfigRow[] = [];
  if (form.mibiPrefix || form.mibiStart || form.mibiLength != null) {
    rows.push({ serviceType: "MIBI",    prefix: form.mibiPrefix ?? "", start: form.mibiStart ?? "", length: form.mibiLength?.toString() ?? "" });
  }
  if (form.pocPrefix || form.pocLength != null) {
    rows.push({ serviceType: "POC",     prefix: form.pocPrefix ?? "",  start: "",                  length: form.pocLength?.toString() ?? "" });
  }
  if (form.routineLength != null) {
    rows.push({ serviceType: "ROUTINE", prefix: "",                    start: "",                  length: form.routineLength.toString() });
  }
  return rows;
}

function fromConfigRows(rows: NumberConfigRow[]): Partial<OrgRuleDto> {
  const out: Partial<OrgRuleDto> = { mibiPrefix: "", mibiStart: "", mibiLength: null, pocPrefix: "", pocLength: null, routineLength: null };
  for (const row of rows) {
    const len = row.length ? parseInt(row.length, 10) : null;
    const key = normalise(row.serviceType);
    if (key === "MIBI")    { out.mibiPrefix = row.prefix; out.mibiStart = row.start; out.mibiLength = len; }
    else if (key === "POC")     { out.pocPrefix = row.prefix; out.pocLength = len; }
    else if (key === "ROUTINE") { out.routineLength = len; }
    // Custom types (from FHIR): all three fields editable in UI; no dedicated DB column yet
  }
  return out;
}

function NumberConfigEditor({
  form,
  onChange,
  serviceTypes,
  t,
}: {
  form:         Partial<OrgRuleDto>;
  onChange:     (updates: Partial<OrgRuleDto>) => void;
  serviceTypes: string[];
  t:            (k: string) => string;
}) {
  const [rows, setRows] = useState<NumberConfigRow[]>(() => toConfigRows(form));
  const [addType, setAddType] = useState<string>(serviceTypes[0] ?? "");

  const usedTypes = new Set(rows.map((r) => r.serviceType));
  const availableTypes = serviceTypes.filter((st) => !usedTypes.has(st));

  function updateRow(index: number, patch: Partial<NumberConfigRow>) {
    const next = rows.map((r, i) => i === index ? { ...r, ...patch } : r);
    setRows(next);
    onChange(fromConfigRows(next));
  }

  function removeRow(index: number) {
    const next = rows.filter((_, i) => i !== index);
    setRows(next);
    onChange(fromConfigRows(next));
  }

  function addRow() {
    if (!availableTypes.includes(addType)) return;
    const next = [...rows, { serviceType: addType, prefix: "", start: "", length: "" }];
    setRows(next);
    onChange(fromConfigRows(next));
    const remaining = serviceTypes.filter((st) => !new Set(next.map((r) => r.serviceType)).has(st));
    if (remaining.length > 0 && remaining[0]) setAddType(remaining[0]);
  }

  const cell = "px-3 py-2 text-[12px]";
  const inp  = "w-full rounded border border-zt-border bg-zt-bg-page px-2 py-1 text-[12px] font-mono text-zt-text-primary focus:outline-none focus:border-zt-primary";

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <table className="w-full border-collapse rounded-lg overflow-hidden border border-zt-border">
          <thead>
            <tr className="bg-zt-bg-card border-b border-zt-border">
              <th className={`${cell} text-left font-medium text-zt-text-tertiary`}>{t("orgRules.serviceTypeCol")}</th>
              <th className={`${cell} text-left font-medium text-zt-text-tertiary`}>{t("orgRules.prefix")}</th>
              <th className={`${cell} text-left font-medium text-zt-text-tertiary`}>{t("orgRules.startDigit")}</th>
              <th className={`${cell} text-left font-medium text-zt-text-tertiary`}>{t("orgRules.totalLength")}</th>
              <th className={`${cell} w-10`}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.serviceType} className="border-b border-zt-border/50 last:border-0">
                <td className={cell}>
                  <span className="font-mono font-semibold text-zt-text-primary">{row.serviceType}</span>
                </td>
                <td className={cell}>
                  <input
                    type="text"
                    value={row.prefix}
                    onChange={(e) => updateRow(i, { prefix: e.target.value })}
                    placeholder="z.B. MI"
                    className={inp}
                  />
                </td>
                <td className={cell}>
                  <input
                    type="text"
                    value={row.start}
                    onChange={(e) => updateRow(i, { start: e.target.value })}
                    placeholder="z.B. 4"
                    className={inp}
                  />
                </td>
                <td className={cell}>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={row.length}
                    onChange={(e) => updateRow(i, { length: e.target.value })}
                    placeholder="10"
                    className={inp}
                  />
                </td>
                <td className={`${cell} text-center`}>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-zt-danger hover:opacity-70 transition-opacity text-[13px]"
                    title={t("common.delete")}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {availableTypes.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <select
            value={addType}
            onChange={(e) => setAddType(e.target.value)}
            className="rounded border border-zt-border bg-zt-bg-page px-2 py-1 text-[12px] font-mono text-zt-text-primary focus:outline-none"
          >
            {availableTypes.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
          <button
            type="button"
            onClick={addRow}
            className="px-3 py-1 text-[12px] rounded bg-zt-primary text-white hover:opacity-90 transition-opacity"
          >
            + {t("orgRules.addServiceType")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── RuleForm ───────────────────────────────────────────────────────────────────

function RuleForm({
  initial,
  onSave,
  onCancel,
  busy,
  error,
  serviceTypes,
  t,
}: {
  initial:      Partial<OrgRuleDto>;
  onSave:       (data: Partial<OrgRuleDto>) => Promise<void>;
  onCancel:     () => void;
  busy:         boolean;
  error:        string | null;
  serviceTypes: string[];
  t:            (k: string) => string;
}) {
  const [form, setForm] = useState<Partial<OrgRuleDto>>(initial);

  function set(key: keyof OrgRuleDto, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFhirSelect(r: FhirOrgResult) {
    setForm((prev) => ({ ...prev, orgFhirId: r.orgFhirId, orgGln: r.orgGln, orgName: r.orgName }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave(form);
  }

  const textField = (label: string, key: keyof OrgRuleDto, placeholder?: string, mono = false) => (
    <div>
      <label className="block text-[11px] text-zt-text-tertiary mb-1">{label}</label>
      <input
        type="text"
        value={(form[key] as string) ?? ""}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-zt-border bg-zt-bg-page px-3 py-1.5 text-[13px] text-zt-text-primary focus:outline-none focus:border-zt-primary transition-colors ${mono ? "font-mono" : ""}`}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-5 bg-zt-bg-card border border-zt-border rounded-xl">

      {/* FHIR Org Search */}
      <div className="grid grid-cols-2 gap-4">
        <OrgSearchField onSelect={handleFhirSelect} t={t} />
        {textField("FHIR Organisation ID", "orgFhirId", "org-zlz", true)}
        {textField("GLN", "orgGln", "7601000000000", true)}
        {textField(t("orgRules.orgName"), "orgName", "ZLZ Zentrallabor AG")}
        {textField(t("orgRules.patientPrefix"), "patientPrefix", "ZLZ")}
        {textField(t("orgRules.casePrefix"), "casePrefix", "F")}
      </div>

      {/* HL7 */}
      <div>
        <p className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wider mb-3">HL7 MSH</p>
        <div className="grid grid-cols-4 gap-3">
          {textField("MSH-3 (Sending App)", "hl7Msh3", "ORDERENTRY", true)}
          {textField("MSH-4 (Sending Fac)", "hl7Msh4", "ZLZ", true)}
          {textField("MSH-5 (Receiving App)", "hl7Msh5", "LIS", true)}
          {textField("MSH-6 (Receiving Fac)", "hl7Msh6", "ZLZ", true)}
        </div>
      </div>

      {/* Order Number Config */}
      <div>
        <p className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wider mb-1">{t("orgRules.numberConfig")}</p>
        <p className="text-[11px] text-zt-text-tertiary mb-3">{t("orgRules.numberConfigHint")}</p>
        <NumberConfigEditor
          form={form}
          onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
          serviceTypes={serviceTypes}
          t={t}
        />
      </div>

      {/* Service Type Mapping */}
      <div className="grid grid-cols-2 gap-4">
        <MappingEditor
          value={(form.serviceTypeMapping as Record<string, string>) ?? {}}
          onChange={(v) => set("serviceTypeMapping", v)}
          serviceTypes={serviceTypes}
          t={t}
        />
      </div>

      {error && <div className="text-[12px] text-zt-danger">{error}</div>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-1.5 text-[13px] rounded-lg bg-zt-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {busy ? t("common.saving") : t("common.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-[13px] rounded-lg border border-zt-border text-zt-text-secondary hover:bg-zt-bg-muted transition-colors"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

// ── RuleRow ────────────────────────────────────────────────────────────────────

function RuleRow({
  rule,
  onEdit,
  onDelete,
  t,
}: {
  rule:     OrgRuleDto;
  onEdit:   () => void;
  onDelete: () => void;
  t:        (k: string) => string;
}) {
  const numConfig = [
    rule.mibiPrefix && `MIBI:${rule.mibiPrefix}${rule.mibiStart || ""}`,
    rule.pocPrefix  && `POC:${rule.pocPrefix}`,
    rule.routineLength && `R:${rule.routineLength}`,
  ].filter(Boolean).join(" ");

  const mappingCount = Object.keys(rule.serviceTypeMapping ?? {}).length;

  return (
    <tr className="border-b border-zt-border/50 last:border-0 hover:bg-zt-bg-page transition-colors">
      <td className="px-4 py-3 text-[13px] font-medium text-zt-text-primary">{rule.orgName || "—"}</td>
      <td className="px-4 py-3 text-[12px] font-mono text-zt-text-tertiary">{rule.orgGln || "—"}</td>
      <td className="px-4 py-3 text-[12px] font-mono text-zt-text-tertiary">{rule.orgFhirId || "—"}</td>
      <td className="px-4 py-3 text-[12px] text-zt-text-secondary">
        {numConfig || <span className="text-zt-text-tertiary italic">global</span>}
      </td>
      <td className="px-4 py-3 text-[12px] text-zt-text-tertiary">
        {mappingCount > 0 ? `${mappingCount} Einträge` : "—"}
      </td>
      <td className="px-4 py-3 text-[12px] font-mono text-zt-text-tertiary">
        {[rule.hl7Msh3, rule.hl7Msh4, rule.hl7Msh5, rule.hl7Msh6].filter(Boolean).join(" | ") || "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="px-2.5 py-1 text-[11px] rounded border border-zt-border text-zt-text-secondary hover:bg-zt-bg-muted transition-colors"
          >
            {t("common.edit")}
          </button>
          <button
            onClick={onDelete}
            className="px-2.5 py-1 text-[11px] rounded border border-zt-danger-border text-zt-danger hover:bg-zt-danger-light transition-colors"
          >
            {t("common.delete")}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── OrgRulesPage ───────────────────────────────────────────────────────────────

export default function OrgRulesPage({ mode = "page" }: { mode?: "page" | "tab" }) {
  const { t } = useTranslation();
  const { rules, loading, error, createRule, updateRule, deleteRule } = useOrgRules();
  const { serviceTypes } = useServiceTypes();

  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData,  setFormData]  = useState<Partial<OrgRuleDto>>(emptyRule());
  const [formBusy,  setFormBusy]  = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function handleNewClick() {
    setFormData(emptyRule());
    setEditingId(null);
    setFormError(null);
    setShowForm(true);
  }

  function handleEditClick(rule: OrgRuleDto) {
    setFormData({ ...rule });
    setEditingId(rule.id ?? null);
    setFormError(null);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

  async function handleSave(data: Partial<OrgRuleDto>) {
    setFormBusy(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateRule(editingId, data);
      } else {
        await createRule(data);
      }
      setShowForm(false);
      setEditingId(null);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : t("orgRules.saveFailed"));
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("orgRules.confirmDelete"))) return;
    await deleteRule(id).catch(() => undefined);
  }

  const inner = (
    <div className={mode === "tab" ? "py-4" : "px-8 py-7 max-w-[1200px] mx-auto"}>

      {mode === "page" && (
        <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary mb-4">
          <BackButton />
          <span>|</span>
          <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
          <span>/</span>
          <span className="text-zt-text-primary">{t("nav.adminOrgRules")}</span>
        </nav>
      )}

      <div className="flex items-center justify-between mb-6">
        {mode === "page" && (
          <div>
            <h1 className="text-[20px] font-medium text-zt-text-primary">{t("orgRules.title")}</h1>
            <p className="text-[13px] text-zt-text-tertiary mt-0.5">{t("orgRules.subtitle")}</p>
          </div>
        )}
        {mode === "tab" && <div />}
            {!showForm && (
              <button
                onClick={handleNewClick}
                className="px-4 py-2 text-[13px] rounded-lg bg-zt-primary text-white hover:opacity-90 transition-opacity"
              >
                + {t("orgRules.addRule")}
              </button>
            )}
          </div>

          {showForm && (
            <div className="mb-6">
              <h2 className="text-[14px] font-medium text-zt-text-primary mb-3">
                {editingId ? t("orgRules.editRule") : t("orgRules.newRule")}
              </h2>
              <RuleForm
                initial={formData}
                onSave={handleSave}
                onCancel={handleCancel}
                busy={formBusy}
                error={formError}
                serviceTypes={serviceTypes}
                t={t}
              />
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-10 rounded bg-zt-bg-card animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-zt-danger-border bg-zt-danger-light px-5 py-4 text-[13px] text-zt-danger">
              {error}
            </div>
          )}

          {!loading && !error && rules.length === 0 && !showForm && (
            <div className="rounded-xl border border-zt-border bg-zt-bg-card px-5 py-8 text-center text-[13px] text-zt-text-tertiary">
              {t("orgRules.empty")}
            </div>
          )}

          {!loading && !error && rules.length > 0 && (
            <div className="rounded-xl border border-zt-border overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-zt-border bg-zt-bg-card">
                    <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium">{t("orgRules.orgName")}</th>
                    <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium">GLN</th>
                    <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium">FHIR ID</th>
                    <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium">{t("orgRules.numberConfig")}</th>
                    <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium">{t("orgRules.mappingTitle")}</th>
                    <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium">HL7 MSH</th>
                    <th className="px-4 py-2.5 text-left text-[11px] text-zt-text-tertiary font-medium w-28">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      onEdit={() => handleEditClick(rule)}
                      onDelete={() => handleDelete(rule.id!)}
                      t={t}
                    />
                  ))}
                </tbody>
              </table>
            </div>
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
