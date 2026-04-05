"use client";

import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/presentation/ui/Badge";
import { Button } from "@/presentation/ui/Button";
import { Input } from "@/presentation/ui/Input";
import { Card } from "@/presentation/ui/Card";
import { formatDate } from "@/shared/utils/formatDate";
import type { AgentRegistrationResponseDto, RegisterAgentRequestDto } from "@/infrastructure/api/dto/AgentRegistrationDto";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NewKeyInfo {
  agentName: string;
  apiKey: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: string, lastSeenAt: string | null) {
  if (status === "revoked") return <Badge label="Gesperrt" variant="danger" />;
  if (!lastSeenAt) return <Badge label="Nie verbunden" variant="neutral" />;

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffMin = diffMs / 60_000;

  if (diffMin < 2)   return <Badge label="Online"  variant="success" />;
  if (diffMin < 60)  return <Badge label="Inaktiv" variant="warning" />;
  return <Badge label="Offline" variant="danger" />;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AgentsPage() {
  const [agents, setAgents] = useState<AgentRegistrationResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyInfo | null>(null);
  const [form, setForm] = useState<RegisterAgentRequestDto>({ name: "", orgFhirId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/agents");
      const data = await res.json() as { agents: AgentRegistrationResponseDto[] };
      setAgents(data.agents ?? []);
    } catch {
      setError("Agents konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAgents(); }, [loadAgents]);

  const handleRegister = useCallback(async () => {
    if (!form.name.trim() || !form.orgFhirId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/agent/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { name: string; apiKey: string };
      setNewKey({ agentName: data.name, apiKey: data.apiKey });
      setShowRegister(false);
      setForm({ name: "", orgFhirId: "" });
      await loadAgents();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [form, loadAgents]);

  const handleRevoke = useCallback(async (id: string) => {
    if (!confirm("Agent sperren?")) return;
    await fetch(`/api/v1/admin/agents/${id}`, { method: "PATCH" });
    await loadAgents();
  }, [loadAgents]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Agent löschen?")) return;
    await fetch(`/api/v1/admin/agents/${id}`, { method: "DELETE" });
    await loadAgents();
  }, [loadAgents]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-zt-bg-page">
      <AppSidebar />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="text-xl font-semibold text-zt-text-primary">Local Agents</h1>
              <p className="text-sm text-zt-text-secondary">Registrierte Kliniken und Praxen</p>
            </div>
          </div>
          <Button variant="primary" onClick={() => setShowRegister(true)}>
            + Agent registrieren
          </Button>
        </div>

        {error && (
          <div className="rounded-md bg-zt-danger-light border border-zt-danger-border px-4 py-3 text-sm text-zt-danger">
            {error}
          </div>
        )}

        {/* API Key — shown once after registration */}
        {newKey && (
          <Card title={`✓ Agent registriert — ${newKey.agentName}`}>
            <div className="space-y-3">
              <p className="text-sm text-zt-text-secondary">
                Bitte den API-Key jetzt kopieren — er wird nur einmal angezeigt.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-zt-bg-muted px-3 py-2 text-sm font-mono text-zt-text-primary break-all">
                  {newKey.apiKey}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(newKey.apiKey)}
                >
                  Kopieren
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setNewKey(null)}>
                Schliessen
              </Button>
            </div>
          </Card>
        )}

        {/* Register Form */}
        {showRegister && (
          <Card title="Neuen Agent registrieren">
            <div className="space-y-4">
              <Input
                label="Name der Klinik / Praxis"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Klinik im Park"
              />
              <Input
                label="FHIR Organization ID"
                value={form.orgFhirId}
                onChange={(e) => setForm((f) => ({ ...f, orgFhirId: e.target.value }))}
                placeholder="klinik-im-park"
              />
              <Input
                label="GLN (optional)"
                value={form.orgGln ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((f) => ({
                    name: f.name,
                    orgFhirId: f.orgFhirId,
                    ...(val ? { orgGln: val } : {}),
                  }));
                }}
                placeholder="7601000123456"
              />
              <div className="flex gap-2 pt-2">
                <Button variant="primary" loading={saving} onClick={() => void handleRegister()}>
                  Registrieren
                </Button>
                <Button variant="ghost" onClick={() => setShowRegister(false)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Agents Table */}
        <Card title={`Agents (${agents.length})`}>
          {loading ? (
            <p className="text-sm text-zt-text-secondary py-4">Laden…</p>
          ) : agents.length === 0 ? (
            <p className="text-sm text-zt-text-secondary py-4">Noch keine Agents registriert.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zt-border text-left text-zt-text-secondary">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Org ID</th>
                    <th className="pb-2 pr-4 font-medium">API-Key</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Version</th>
                    <th className="pb-2 pr-4 font-medium">Zuletzt gesehen</th>
                    <th className="pb-2 font-medium">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.id} className="border-b border-zt-border last:border-0">
                      <td className="py-3 pr-4 font-medium text-zt-text-primary">{a.name}</td>
                      <td className="py-3 pr-4 text-zt-text-secondary font-mono text-xs">{a.orgFhirId}</td>
                      <td className="py-3 pr-4 text-zt-text-secondary font-mono text-xs">{a.apiKeyPrefix}…</td>
                      <td className="py-3 pr-4">{statusBadge(a.status, a.lastSeenAt)}</td>
                      <td className="py-3 pr-4 text-zt-text-secondary">{a.agentVersion ?? "—"}</td>
                      <td className="py-3 pr-4 text-zt-text-secondary">
                        {a.lastSeenAt ? formatDate(a.lastSeenAt) : "—"}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          {a.status === "active" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleRevoke(a.id)}
                            >
                              Sperren
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void handleDelete(a.id)}
                          >
                            Löschen
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
