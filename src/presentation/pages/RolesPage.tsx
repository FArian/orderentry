"use client";

/**
 * RolesPage — Admin role catalog management.
 *
 * Follows the same AppSidebar layout as UsersPage.
 * Features:
 *   - Table of all catalog roles (Code | Display | System | Created | Actions)
 *   - Create role modal (code, display, optional system OID)
 *   - Edit role modal
 *   - Delete with confirmation
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { BackButton } from "@/components/BackButton";
import { useRoles } from "@/presentation/hooks/useRoles";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/shared/utils/formatDate";
import type { RoleCatalogEntryDto, CreateRoleRequestDto, UpdateRoleRequestDto } from "@/infrastructure/api/dto/RoleDto";

// ── RoleFormModal ─────────────────────────────────────────────────────────────

interface RoleFormModalProps {
  mode:    "create" | "edit";
  initial?: RoleCatalogEntryDto;
  onSave:  (data: CreateRoleRequestDto | UpdateRoleRequestDto) => Promise<void>;
  onClose: () => void;
  saving:  boolean;
  error:   string | null;
  t:       (k: string) => string;
}

function RoleFormModal({ mode, initial, onSave, onClose, saving, error, t }: RoleFormModalProps) {
  const [code,    setCode]    = useState(initial?.code    ?? "");
  const [display, setDisplay] = useState(initial?.display ?? "");
  const [system,  setSystem]  = useState(initial?.system  ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({
      ...(code.trim()    ? { code:    code.trim()    } : {}),
      ...(display.trim() ? { display: display.trim() } : {}),
      ...(system.trim()  ? { system:  system.trim()  } : { system: "" }),
    });
  }

  const fieldCls  = "w-full px-3 py-2 text-[13px] border border-zt-border rounded-lg bg-zt-bg-page text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary focus:ring-2 focus:ring-zt-primary/10";
  const labelCls  = "block text-[12px] font-medium text-zt-text-secondary mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-zt-bg-card border border-zt-border rounded-xl shadow-2xl w-[480px] max-w-[95vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zt-border">
          <span className="text-[15px] font-medium text-zt-text-primary">
            {mode === "create" ? t("roles.createTitle") : t("roles.editTitle")}
          </span>
          <button type="button" onClick={onClose} className="text-zt-text-tertiary hover:text-zt-text-primary text-xl px-1">×</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={labelCls}>{t("roles.code")} *</label>
            <input
              required
              className={fieldCls}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="GrpPra"
              disabled={mode === "edit"} // code is immutable after creation
            />
          </div>
          <div>
            <label className={labelCls}>{t("roles.display")} *</label>
            <input required className={fieldCls} value={display} onChange={(e) => setDisplay(e.target.value)} placeholder="Gruppenpraxis" />
          </div>
          <div>
            <label className={labelCls}>{t("roles.system")}</label>
            <input className={fieldCls} value={system} onChange={(e) => setSystem(e.target.value)} placeholder={t("roles.systemPlaceholder")} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-zt-border">
          {error ? (
            <span className="text-[12px] text-zt-danger">{error}</span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="text-[13px] px-4 py-2 rounded-lg border border-zt-border bg-zt-bg-card text-zt-text-primary hover:bg-zt-bg-page transition-colors">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={saving}
              className="text-[13px] px-4 py-2 rounded-lg bg-zt-primary text-zt-text-on-primary hover:bg-zt-primary/90 disabled:opacity-40 transition-colors">
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── RolesPage ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { t } = useTranslation();
  const { roles, loading, error, createRole, updateRole, deleteRole } = useRoles();

  const [modal,       setModal]       = useState<null | "create" | "edit">(null);
  const [editTarget,  setEditTarget]  = useState<RoleCatalogEntryDto | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError,  setModalError]  = useState<string | null>(null);
  const [flashMsg,    setFlashMsg]    = useState<{ text: string; ok: boolean } | null>(null);

  function flash(text: string, ok: boolean) {
    setFlashMsg({ text, ok });
    setTimeout(() => setFlashMsg(null), 3000);
  }

  const openCreate = () => { setEditTarget(null); setModalError(null); setModal("create"); };
  const openEdit   = (r: RoleCatalogEntryDto) => { setEditTarget(r); setModalError(null); setModal("edit"); };
  const closeModal = () => { setModal(null); setEditTarget(null); };

  const handleSave = useCallback(async (data: CreateRoleRequestDto | UpdateRoleRequestDto) => {
    setModalSaving(true);
    setModalError(null);
    try {
      if (modal === "create") {
        await createRole(data as CreateRoleRequestDto);
        flash(t("roles.createOk"), true);
      } else if (editTarget) {
        await updateRole(editTarget.id, data as UpdateRoleRequestDto);
        flash(t("roles.updateOk"), true);
      }
      closeModal();
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setModalSaving(false);
    }
  }, [modal, editTarget, createRole, updateRole, t]);

  const handleDelete = useCallback(async (r: RoleCatalogEntryDto) => {
    if (!window.confirm(t("roles.deleteConfirm"))) return;
    try {
      await deleteRole(r.id);
      flash(t("roles.deleteOk"), true);
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : String(e), false);
    }
  }, [deleteRole, t]);

  return (
    <div className="flex flex-1 min-h-0">
      <AppSidebar />

      {modal && (
        <RoleFormModal
          mode={modal}
          {...(editTarget !== null ? { initial: editTarget } : {})}
          onSave={handleSave}
          onClose={closeModal}
          saving={modalSaving}
          error={modalError}
          t={t}
        />
      )}

      <div className="flex-1 overflow-y-auto bg-zt-bg-page">
        <div className="px-8 py-7 max-w-[900px] mx-auto">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] text-zt-text-tertiary mb-4">
            <BackButton />
            <span className="text-zt-text-tertiary">|</span>
            <Link href="/" className="text-zt-primary hover:underline">{t("nav.home")}</Link>
            <span>/</span>
            <span className="text-zt-text-primary">{t("roles.title")}</span>
          </nav>

          {/* Page header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-[20px] font-medium text-zt-text-primary">{t("roles.title")}</h1>
              <p className="text-[13px] text-zt-text-tertiary mt-0.5">
                {roles.length} {t(roles.length === 1 ? "roles.countOne" : "roles.countMany")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {flashMsg && (
                <div className={`rounded border px-3 py-1.5 text-[12px] ${
                  flashMsg.ok
                    ? "border-zt-success-border bg-zt-success-light text-zt-success"
                    : "border-zt-danger-border bg-zt-danger-light text-zt-danger"
                }`}>
                  {flashMsg.text}
                </div>
              )}
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 text-[13px] px-3.5 py-[7px] rounded-lg bg-zt-primary text-zt-text-on-primary hover:bg-zt-primary/90 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {t("roles.createBtn")}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-zt-bg-card border border-zt-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-zt-bg-page">
                  {[t("roles.colCode"), t("roles.colDisplay"), t("roles.colSystem"), t("orders.date"), t("orders.actions")].map((h) => (
                    <th key={h} className="text-left text-[11px] font-medium text-zt-text-secondary uppercase tracking-[0.04em] px-4 py-2.5 border-b border-zt-border whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-b border-zt-border/50 last:border-0">
                    {Array.from({ length: 5 }, (__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-zt-bg-muted animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && error && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px] text-zt-danger">{error}</td></tr>
                )}

                {!loading && !error && roles.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-[13px] text-zt-text-tertiary">{t("roles.noResults")}</td></tr>
                )}

                {!loading && !error && roles.map((r) => (
                  <tr key={r.id} className="border-b border-zt-border/50 last:border-0 hover:bg-zt-bg-page transition-colors">
                    <td className="px-4 py-[11px] align-middle">
                      <span className="font-mono text-[13px] font-medium text-zt-text-primary">{r.code}</span>
                    </td>
                    <td className="px-4 py-[11px] align-middle text-[13px] text-zt-text-primary">{r.display}</td>
                    <td className="px-4 py-[11px] align-middle text-[11px] text-zt-text-tertiary font-mono truncate max-w-[200px]">
                      {r.system ?? "—"}
                    </td>
                    <td className="px-4 py-[11px] align-middle text-[12px] text-zt-text-secondary whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-[11px] align-middle">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(r)}
                          className="text-[11px] px-[9px] py-[3px] rounded-[6px] border border-zt-border bg-zt-bg-card text-zt-text-primary hover:bg-zt-bg-page whitespace-nowrap transition-colors cursor-pointer"
                        >
                          {t("orders.edit")}
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          className="text-[11px] px-[9px] py-[3px] rounded-[6px] border border-zt-danger-border bg-zt-bg-card text-zt-danger hover:bg-zt-danger-light whitespace-nowrap transition-colors cursor-pointer"
                        >
                          {t("orders.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Info box */}
          <div className="mt-4 rounded-lg border border-zt-border bg-zt-bg-card px-4 py-3 text-[12px] text-zt-text-secondary">
            <strong className="text-zt-text-primary">{t("roles.hintLabel")}:</strong>{" "}
            {t("roles.hintText")}
          </div>

        </div>
      </div>
    </div>
  );
}
