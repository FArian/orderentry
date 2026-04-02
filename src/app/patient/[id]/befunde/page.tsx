"use client";

import { useEffect, useState, useMemo, useCallback, use } from "react";
import Link from "next/link";
import PatientBreadcrumb from "../PatientBreadcrumb";
import {
  DataTable,
  DataTableHead,
  DataTableHeadRow,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from "@/components/Table";
import { useTranslation } from "@/lib/i18n";
import { useRefresh } from "@/lib/refresh";
import { formatDate } from "@/shared/utils/formatDate";
import { b64toDataUrl, decodeB64Utf8 } from "@/shared/utils/base64";

// ── Types ─────────────────────────────────────────────────────────────────────

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

type DocRefRow = {
  id: string;
  status: string;
  docStatus: string;
  typeText: string;
  description: string;
  date: string;
  author: string;
  hasPdf: boolean;
  hasHl7: boolean;
  pdfData: string | null;
  pdfTitle: string | null;
  hl7Data: string | null;
  hl7Title: string | null;
  related: string[];
};

type Tab = "reports" | "documents";

// ── Status badges ─────────────────────────────────────────────────────────────

type StatusMeta = { icon: string; badge: string; label: string; tooltip: string };

function getDrStatusMeta(status: string, t: (k: string) => string): StatusMeta {
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

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const meta = getDrStatusMeta(status, t);
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

// ── Preview Modal ─────────────────────────────────────────────────────────────

type ModalState =
  | { type: "pdf"; data: string; title: string }
  | { type: "hl7"; content: string; title: string }
  | null;

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl flex flex-col"
        style={{ width: "900px", maxWidth: "96vw", height: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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

        {/* Content */}
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

// ── Action buttons ────────────────────────────────────────────────────────────

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BefundePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const { refreshCount } = useRefresh();

  const [activeTab, setActiveTab] = useState<Tab>("reports");
  const [modal, setModal] = useState<ModalState>(null);

  const [befunde, setBefunde] = useState<BefundRow[]>([]);
  const [befundeLoading, setBefundeLoading] = useState(true);
  const [befundeError, setBefundeError] = useState<string | null>(null);

  const [docs, setDocs] = useState<DocRefRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  const loadBefunde = useCallback(() => {
    let active = true;
    setBefundeLoading(true);
    setBefundeError(null);
    fetch(`/api/patients/${encodeURIComponent(id)}/diagnostic-reports`)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: BefundRow[] };
        setBefunde(Array.isArray(json.data) ? json.data : []);
      })
      .catch((e: unknown) => { if (active) setBefundeError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setBefundeLoading(false); });
    return () => { active = false; };
  }, [id]);

  const loadDocs = useCallback(() => {
    let active = true;
    setDocsLoading(true);
    setDocsError(null);
    fetch(`/api/patients/${encodeURIComponent(id)}/document-references`)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: DocRefRow[] };
        setDocs(Array.isArray(json.data) ? json.data : []);
      })
      .catch((e: unknown) => { if (active) setDocsError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setDocsLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => { return loadBefunde(); }, [loadBefunde, refreshCount]);
  useEffect(() => { return loadDocs(); }, [loadDocs, refreshCount]);

  // ── DiagnosticReport rows ────────────────────────────────────────────────

  const befundeContent = useMemo(() => {
    if (befundeLoading) {
      return Array.from({ length: 4 }, (_, i) => (
        <DataTableRow key={`skel-${i}`}>
          {Array.from({ length: 6 }, (__, j) => (
            <DataTableCell key={j}><div className="h-4 rounded bg-gray-100 animate-pulse" /></DataTableCell>
          ))}
        </DataTableRow>
      ));
    }
    if (befundeError) {
      return <DataTableRow><DataTableCell colSpan={6} className="text-red-600">{t("befunde.loadError")}: {befundeError}</DataTableCell></DataTableRow>;
    }
    if (befunde.length === 0) {
      return <DataTableRow><DataTableCell colSpan={6} className="text-gray-500">{t("befunde.noResults")}</DataTableCell></DataTableRow>;
    }
    return befunde.map((b) => (
      <DataTableRow key={b.id}>
        <DataTableCell title={b.codeText}>{b.codeText || "-"}</DataTableCell>
        <DataTableCell>{b.category || "-"}</DataTableCell>
        <DataTableCell><StatusBadge status={b.status} t={t} /></DataTableCell>
        <DataTableCell>{formatDate(b.effectiveDate)}</DataTableCell>
        <DataTableCell>
          <div className="text-xs text-gray-700">
            {b.conclusion
              ? <span title={b.conclusion} className="block max-w-xs truncate">{b.conclusion}</span>
              : <span className="text-gray-400">{b.resultCount} {t("befunde.observations")}</span>
            }
            {b.basedOn.length > 0 && (
              <div className="mt-0.5">
                {b.basedOn.map((ref) => {
                  const srId = ref.startsWith("ServiceRequest/") ? ref.slice("ServiceRequest/".length) : ref;
                  return (
                    <Link key={ref} href={`/order/${id}?sr=${srId}`} className="text-blue-600 hover:underline text-xs mr-1">
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
    ));
  }, [befundeLoading, befundeError, befunde, t, id]);

  // ── DocumentReference rows ───────────────────────────────────────────────

  const docsContent = useMemo(() => {
    if (docsLoading) {
      return Array.from({ length: 3 }, (_, i) => (
        <DataTableRow key={`dskel-${i}`}>
          {Array.from({ length: 5 }, (__, j) => (
            <DataTableCell key={j}><div className="h-4 rounded bg-gray-100 animate-pulse" /></DataTableCell>
          ))}
        </DataTableRow>
      ));
    }
    if (docsError) {
      return <DataTableRow><DataTableCell colSpan={5} className="text-red-600">{t("befunde.loadError")}: {docsError}</DataTableCell></DataTableRow>;
    }
    if (docs.length === 0) {
      return <DataTableRow><DataTableCell colSpan={5} className="text-gray-500">{t("befunde.noDocuments")}</DataTableCell></DataTableRow>;
    }
    return docs.map((d) => (
      <DataTableRow key={d.id}>
        <DataTableCell title={d.description || d.typeText}>{d.description || d.typeText || "-"}</DataTableCell>
        <DataTableCell>{d.author || "-"}</DataTableCell>
        <DataTableCell>
          <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${d.docStatus === "final" ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-600 border-gray-300"}`}>
            {d.docStatus || d.status || "-"}
          </span>
        </DataTableCell>
        <DataTableCell>{formatDate(d.date)}</DataTableCell>
        <DataTableCell>
          <PreviewButtons
            pdfData={d.pdfData} pdfTitle={d.pdfTitle || d.description}
            hl7Data={d.hl7Data} hl7Title={d.hl7Title || "HL7 MDM^T02"}
            onOpen={setModal}
          />
        </DataTableCell>
      </DataTableRow>
    ));
  }, [docsLoading, docsError, docs, t]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      <PreviewModal modal={modal} onClose={() => setModal(null)} />

      <div className="p-4">
        <PatientBreadcrumb id={id} />
        <h1 className="text-2xl font-bold">{t("befunde.title")}</h1>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white px-4">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("reports")}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "reports" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            🔬 {t("befunde.tabReports")}
            {befunde.length > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-xs">{befunde.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "documents" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            📁 {t("befunde.tabDocuments")}
            {docs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-xs">{docs.length}</span>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 flex-1">
        {/* DiagnosticReport tab */}
        {activeTab === "reports" && (
          <DataTable>
            <DataTableHead>
              <DataTableHeadRow>
                <DataTableHeaderCell>{t("befunde.code")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-36">{t("befunde.category")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-40">{t("befunde.status")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-32">{t("befunde.date")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("befunde.result")}</DataTableHeaderCell>
                <DataTableHeaderCell className="w-36">{t("befunde.documents")}</DataTableHeaderCell>
              </DataTableHeadRow>
            </DataTableHead>
            <DataTableBody>{befundeContent}</DataTableBody>
          </DataTable>
        )}

        {/* DocumentReference tab */}
        {activeTab === "documents" && (
          <>
            <p className="mb-3 text-xs text-gray-500">
              FHIR: <code>DocumentReference</code> ↔ HL7 <code>MDM^T02</code>
            </p>
            <DataTable>
              <DataTableHead>
                <DataTableHeadRow>
                  <DataTableHeaderCell>{t("befunde.docDescription")}</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-48">{t("befunde.docAuthor")}</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-32">{t("befunde.status")}</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-32">{t("befunde.date")}</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-36">{t("befunde.documents")}</DataTableHeaderCell>
                </DataTableHeadRow>
              </DataTableHead>
              <DataTableBody>{docsContent}</DataTableBody>
            </DataTable>
          </>
        )}
      </div>
    </div>
  );
}
