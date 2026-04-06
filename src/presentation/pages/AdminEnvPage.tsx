"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { Badge, Button, Card, EmptyState } from "@/presentation/ui";
import type { EnvSchemaEntryDto } from "@/infrastructure/api/dto/EnvDto";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnvVar { key: string; value: string }

interface EditState {
  key:   string;
  value: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function useAdminEnv() {
  const [entries,    setEntries]    = useState<EnvSchemaEntryDto[]>([]);
  const [vars,       setVars]       = useState<EnvVar[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [edit,       setEdit]       = useState<EditState | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [saveMsg,    setSaveMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/env/schema").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/env").then((r) => {
        if (r.status === 405) { setIsReadOnly(true); return null; }
        return r.ok ? r.json() : null;
      }),
    ])
      .then(([schema, env]: [{ entries?: EnvSchemaEntryDto[] } | null, { vars?: EnvVar[] } | null]) => {
        if (schema?.entries) setEntries(schema.entries);
        if (env?.vars)       setVars(env.vars);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function startEdit(key: string) {
    const current = vars.find((v) => v.key === key)?.value ?? "";
    setEdit({ key, value: current });
    setSaveMsg(null);
  }

  function cancelEdit() { setEdit(null); }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    setSaveMsg(null);
    const updated = vars.filter((v) => v.key !== edit.key);
    if (edit.value.trim()) updated.push({ key: edit.key, value: edit.value.trim() });
    try {
      const res  = await fetch("/api/env", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vars: updated }) });
      if (res.status === 405) { setIsReadOnly(true); setSaving(false); return; }
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        setVars(updated);
        setEntries((prev) => prev.map((e) => e.key === edit.key ? { ...e, currentValue: edit.value.trim() || e.default } : e));
        setEdit(null);
        setSaveMsg({ ok: true, text: "settings.envEditorSaved" });
        setTimeout(() => setSaveMsg(null), 6000);
      } else {
        setSaveMsg({ ok: false, text: data.message ?? "settings.envEditorError" });
      }
    } catch {
      setSaveMsg({ ok: false, text: "settings.envEditorError" });
    } finally {
      setSaving(false);
    }
  }

  const groups = useMemo(
    () => ["Alle", ...Array.from(new Set(entries.map((e) => e.group))).sort()],
    [entries],
  );

  /** Keys that are present in .env.local (editable via POST /api/env). */
  const localKeys = useMemo(() => new Set(vars.map((v) => v.key)), [vars]);

  return { entries, loading, groups, isReadOnly, edit, startEdit, cancelEdit, saveEdit, saving, saveMsg, setEdit, localKeys };
}

// ── EnvEntryEdit ──────────────────────────────────────────────────────────────

interface EntryEditProps {
  entry:      EnvSchemaEntryDto;
  editValue:  string;
  onChange:   (v: string) => void;
  onSave:     () => void;
  onCancel:   () => void;
  saving:     boolean;
}

function EnvEntryEdit({ entry, editValue, onChange, onSave, onCancel, saving }: EntryEditProps) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 space-y-2">
      <input
        type={entry.secret ? "password" : "text"}
        value={editValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={entry.default || t("admin.envSchema.notSet")}
        autoFocus
        className="w-full rounded border border-zt-primary px-2.5 py-1.5 text-[12px] font-mono bg-zt-bg-page text-zt-text-primary focus:outline-none"
      />
      {entry.secret && (
        <p className="text-[11px] text-zt-warning-text">⚠ {t("admin.envSchema.secretNote")}</p>
      )}
      <p className="text-[11px] text-zt-text-tertiary">
        Default: <code className="font-mono">{entry.default || t("admin.envSchema.notSet")}</code>
        {" — "}
        {t("admin.envSchema.clearNote")}
      </p>
      <div className="flex gap-2">
        <Button variant="primary"   size="sm" loading={saving} onClick={onSave}>{t("common.save")}</Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}

// ── EnvEntry ──────────────────────────────────────────────────────────────────

interface EntryProps {
  entry:          EnvSchemaEntryDto;
  isEditing:      boolean;
  editValue:      string;
  isReadOnly:     boolean;
  isLockedByEnv:  boolean;
  onEdit:         () => void;
  onChange:       (v: string) => void;
  onSave:         () => void;
  onCancel:       () => void;
  saving:         boolean;
}

function EnvEntry({ entry, isEditing, editValue, isReadOnly, isLockedByEnv, onEdit, onChange, onSave, onCancel, saving }: EntryProps) {
  const { t }       = useTranslation();
  const isModified  = !entry.secret && entry.currentValue !== entry.default && entry.currentValue !== "";
  const isEmpty     = entry.currentValue === "" || entry.currentValue === "••••••••";

  return (
    <div className="py-3 border-b border-zt-border last:border-0">
      <div className="flex items-start justify-between gap-3">
        <code className="text-[12px] font-mono font-semibold text-zt-primary break-all">{entry.key}</code>
        <div className="flex items-center flex-wrap gap-1 shrink-0">
          {entry.required        && <Badge variant="danger"  label={t("admin.envSchema.required")} />}
          {entry.secret          && <Badge variant="warning" label={t("admin.envSchema.secret")} />}
          {entry.writable        && <Badge variant="info"    label={t("admin.envSchema.writable")} />}
          {entry.restartRequired && <Badge variant="neutral" label={t("admin.envSchema.restart")} />}
          {isLockedByEnv         && <Badge variant="neutral" label="🔒 ENV" tooltip={t("admin.envSchema.lockedByEnv")} />}
          {entry.writable && !isReadOnly && !isEditing && !isLockedByEnv && (
            <button
              onClick={onEdit}
              className="ml-1 text-[11px] text-zt-primary hover:underline"
              aria-label={`${t("admin.envSchema.editVar")} ${entry.key}`}
            >
              ✎ {t("admin.envSchema.editVar")}
            </button>
          )}
        </div>
      </div>

      <p className="mt-1 text-[12px] text-zt-text-secondary">{entry.description}</p>

      {!isEditing && (
        <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
          <span className="text-zt-text-tertiary">{t("admin.envSchema.default")}:</span>
          <code className="text-zt-text-secondary break-all">
            {entry.default || <em className="not-italic text-zt-text-tertiary">{t("admin.envSchema.notSet")}</em>}
          </code>
          <span className="text-zt-text-tertiary">{t("admin.envSchema.current")}:</span>
          <code className={`break-all ${isModified ? "text-zt-success font-semibold" : "text-zt-text-secondary"}`}>
            {isEmpty
              ? <em className="not-italic text-zt-text-tertiary">{entry.secret ? "••••••••" : t("admin.envSchema.notSet")}</em>
              : entry.currentValue}
            {!isModified && !isEmpty && !entry.secret && (
              <span className="ml-1 text-zt-text-tertiary font-normal">({t("admin.envSchema.isDefault")})</span>
            )}
          </code>
        </div>
      )}

      {isLockedByEnv && !isEditing && (
        <p className="mt-1.5 text-[11px] text-zt-text-tertiary italic">
          {t("admin.envSchema.lockedByEnvNote")}
        </p>
      )}

      {isEditing && (
        <EnvEntryEdit
          entry={entry} editValue={editValue}
          onChange={onChange} onSave={onSave} onCancel={onCancel} saving={saving}
        />
      )}
    </div>
  );
}

// ── AdminEnvPage ──────────────────────────────────────────────────────────────

export function AdminEnvPage() {
  const { t }                         = useTranslation();
  const hook                          = useAdminEnv();
  const [search,      setSearch]      = useState("");
  const [activeGroup, setActiveGroup] = useState("Alle");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hook.entries.filter((e) => {
      const matchGroup  = activeGroup === "Alle" || e.group === activeGroup;
      const matchSearch = !q || e.key.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
      return matchGroup && matchSearch;
    });
  }, [hook.entries, search, activeGroup]);

  const byGroup = useMemo(() => {
    const map = new Map<string, EnvSchemaEntryDto[]>();
    for (const e of filtered) { const list = map.get(e.group) ?? []; list.push(e); map.set(e.group, list); }
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />
      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[860px] mx-auto space-y-5">

          <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary">
            <BackButton />
            <span>|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("admin.envSchema.title")}</span>
          </nav>

          <div>
            <h1 className="text-[20px] font-medium text-zt-text-primary">{t("admin.envSchema.title")}</h1>
            <p className="text-[13px] text-zt-text-secondary mt-0.5">{t("admin.envSchema.subtitle")}</p>
          </div>

          {/* Banners */}
          {hook.isReadOnly && (
            <div className="flex gap-2 rounded-md border border-zt-info-border bg-zt-info-light px-3 py-2 text-[12px] text-zt-info" role="note">
              <span className="font-bold shrink-0">ℹ</span>
              <span>{t("settings.envEditorUnavailable")}</span>
            </div>
          )}
          {!hook.isReadOnly && (
            <div className="flex gap-2 rounded-md border border-zt-warning-border bg-zt-warning-bg px-3 py-2 text-[12px] text-zt-warning-text" role="note">
              <span className="font-bold shrink-0">⚠</span>
              <span>{t("settings.envEditorRestartNote")}</span>
            </div>
          )}
          {hook.saveMsg && (
            <div className={`flex gap-2 rounded-md border px-3 py-2 text-[12px] ${hook.saveMsg.ok ? "border-zt-success-border bg-zt-success-light text-zt-success" : "border-zt-danger-border bg-zt-danger-light text-zt-danger"}`} role="status">
              <span>{hook.saveMsg.ok ? "✓" : "✕"}</span>
              <span>{t(hook.saveMsg.text as Parameters<typeof t>[0])}</span>
            </div>
          )}

          {/* Search + Group Filter */}
          <div className="space-y-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.envSchema.search")}
              className="w-full rounded-lg border border-zt-border bg-zt-bg-card px-3 py-2 text-[13px] text-zt-text-primary placeholder:text-zt-text-tertiary focus:outline-none focus:border-zt-primary"
            />
            <div className="flex flex-wrap gap-1.5">
              {hook.groups.map((g) => (
                <button key={g} onClick={() => setActiveGroup(g)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${activeGroup === g ? "bg-zt-primary text-white border-zt-primary" : "border-zt-border text-zt-text-secondary hover:border-zt-primary hover:text-zt-primary"}`}
                >
                  {g}
                  <span className="ml-1 opacity-60">
                    ({g === "Alle" ? hook.entries.length : hook.entries.filter((e) => e.group === g).length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {hook.loading ? (
            <Card><p className="text-[13px] text-zt-text-tertiary">{t("common.loading")}</p></Card>
          ) : filtered.length === 0 ? (
            <EmptyState title={t("admin.envSchema.noResults")} description={search} />
          ) : (
            Array.from(byGroup.entries()).map(([group, items]) => (
              <Card key={group} title={group} subtitle={`${items.length} Variable${items.length !== 1 ? "n" : ""}`}>
                {items.map((entry) => (
                  <EnvEntry
                    key={entry.key}
                    entry={entry}
                    isEditing={hook.edit?.key === entry.key}
                    editValue={hook.edit?.key === entry.key ? hook.edit.value : ""}
                    isReadOnly={hook.isReadOnly}
                    isLockedByEnv={!hook.localKeys.has(entry.key) && entry.currentValue !== "" && entry.currentValue !== "••••••••"}
                    onEdit={() => hook.startEdit(entry.key)}
                    onChange={(v) => hook.setEdit((prev) => prev ? { ...prev, value: v } : null)}
                    onSave={hook.saveEdit}
                    onCancel={hook.cancelEdit}
                    saving={hook.saving}
                  />
                ))}
              </Card>
            ))
          )}

        </div>
      </div>
    </div>
  );
}
