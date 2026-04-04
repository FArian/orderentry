"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { Badge, Card, EmptyState } from "@/presentation/ui";
import type { EnvSchemaEntryDto } from "@/infrastructure/api/dto/EnvDto";

// ── Hook ──────────────────────────────────────────────────────────────────────

function useAdminEnv() {
  const [entries, setEntries] = useState<EnvSchemaEntryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/env/schema")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { entries?: EnvSchemaEntryDto[] } | null) => {
        if (d?.entries) setEntries(d.entries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(
    () => ["Alle", ...Array.from(new Set(entries.map((e) => e.group))).sort()],
    [entries],
  );

  return { entries, loading, groups };
}

// ── EnvEntry ──────────────────────────────────────────────────────────────────

function EnvEntry({ entry }: { entry: EnvSchemaEntryDto }) {
  const { t } = useTranslation();
  const isModified = !entry.secret && entry.currentValue !== entry.default && entry.currentValue !== "";
  const isEmpty    = entry.currentValue === "" || entry.currentValue === "••••••••";
  return (
    <div className="py-3 border-b border-zt-border last:border-0">
      <div className="flex items-start justify-between gap-3">
        <code className="text-[12px] font-mono font-semibold text-zt-primary break-all">{entry.key}</code>
        <div className="flex flex-wrap gap-1 shrink-0">
          {entry.required        && <Badge variant="danger"  label={t("admin.envSchema.required")} />}
          {entry.secret          && <Badge variant="warning" label={t("admin.envSchema.secret")} />}
          {entry.writable        && <Badge variant="info"    label={t("admin.envSchema.writable")} />}
          {entry.restartRequired && <Badge variant="neutral" label={t("admin.envSchema.restart")} />}
        </div>
      </div>
      <p className="mt-1 text-[12px] text-zt-text-secondary">{entry.description}</p>
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
        <span className="text-zt-text-tertiary">{t("admin.envSchema.default")}:</span>
        <code className="text-zt-text-secondary break-all">{entry.default || <em className="not-italic text-zt-text-tertiary">{t("admin.envSchema.notSet")}</em>}</code>
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
    </div>
  );
}

// ── AdminEnvPage ──────────────────────────────────────────────────────────────

export function AdminEnvPage() {
  const { t }                              = useTranslation();
  const { entries, loading, groups }       = useAdminEnv();
  const [search,    setSearch]             = useState("");
  const [activeGroup, setActiveGroup]      = useState("Alle");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const matchGroup = activeGroup === "Alle" || e.group === activeGroup;
      const matchSearch = !q || e.key.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
      return matchGroup && matchSearch;
    });
  }, [entries, search, activeGroup]);

  const byGroup = useMemo(() => {
    const map = new Map<string, EnvSchemaEntryDto[]>();
    for (const e of filtered) {
      const list = map.get(e.group) ?? [];
      list.push(e);
      map.set(e.group, list);
    }
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

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[20px] font-medium text-zt-text-primary">{t("admin.envSchema.title")}</h1>
              <p className="text-[13px] text-zt-text-secondary mt-0.5">{t("admin.envSchema.subtitle")}</p>
            </div>
            <Link
              href="/settings"
              className="shrink-0 text-[12px] px-3 py-1.5 rounded-lg border border-zt-border text-zt-text-primary hover:bg-zt-bg-card transition-colors"
            >
              {t("admin.envSchema.editLink")} →
            </Link>
          </div>

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
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    activeGroup === g
                      ? "bg-zt-primary text-white border-zt-primary"
                      : "border-zt-border text-zt-text-secondary hover:border-zt-primary hover:text-zt-primary"
                  }`}
                >
                  {g}
                  {g !== "Alle" && <span className="ml-1 opacity-60">({entries.filter((e) => e.group === g).length})</span>}
                  {g === "Alle" && <span className="ml-1 opacity-60">({entries.length})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <Card><p className="text-[13px] text-zt-text-tertiary">{t("common.loading")}</p></Card>
          ) : filtered.length === 0 ? (
            <EmptyState title={t("admin.envSchema.noResults")} description={search} />
          ) : (
            Array.from(byGroup.entries()).map(([group, items]) => (
              <Card key={group} title={group} subtitle={`${items.length} Variable${items.length !== 1 ? "n" : ""}`}>
                {items.map((entry) => <EnvEntry key={entry.key} entry={entry} />)}
              </Card>
            ))
          )}

        </div>
      </div>
    </div>
  );
}
