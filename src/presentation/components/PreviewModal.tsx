"use client";

/**
 * Shared PDF / HL7 preview modal.
 *
 * Previously duplicated in:
 *  - app/patient/[id]/befunde/page.tsx
 *  - app/patient/[id]/PatientDetailClient.tsx
 *  - presentation/pages/ResultsPage.tsx
 */

import { useState } from "react";
import { b64toDataUrl, decodeB64Utf8 } from "@/shared/utils/base64";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModalState =
  | { type: "pdf"; data: string; title: string }
  | { type: "hl7"; content: string; title: string }
  | null;

// ── PreviewButtons ─────────────────────────────────────────────────────────────

interface PreviewButtonsProps {
  pdfData: string | null;
  pdfTitle: string | null;
  hl7Data: string | null;
  hl7Title: string | null;
  onOpen: (modal: ModalState) => void;
}

/**
 * Compact action buttons that open the PDF or HL7 content in `PreviewModal`.
 */
export function PreviewButtons({
  pdfData,
  pdfTitle,
  hl7Data,
  hl7Title,
  onOpen,
}: PreviewButtonsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {pdfData && (
        <button
          onClick={() =>
            onOpen({
              type: "pdf",
              data: b64toDataUrl(pdfData, "application/pdf"),
              title: pdfTitle ?? "PDF",
            })
          }
          className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-100"
        >
          📄 PDF
        </button>
      )}
      {hl7Data && (
        <button
          onClick={() =>
            onOpen({
              type: "hl7",
              content: decodeB64Utf8(hl7Data),
              title: hl7Title ?? "HL7",
            })
          }
          className="inline-flex items-center gap-1 rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100"
        >
          🔬 HL7
        </button>
      )}
    </div>
  );
}

// ── PreviewModal ──────────────────────────────────────────────────────────────

interface PreviewModalProps {
  modal: ModalState;
  onClose: () => void;
}

/**
 * Full-screen overlay modal.
 * - PDF type: renders an `<iframe>` with a download link.
 * - HL7 type: renders a syntax-highlighted `<pre>` with a copy button.
 */
export function PreviewModal({ modal, onClose }: PreviewModalProps) {
  const [copied, setCopied] = useState(false);

  if (!modal) return null;

  function copyHl7() {
    if (modal?.type !== "hl7") return;
    const content = (modal as Extract<ModalState, { type: "hl7" }>).content;
    navigator.clipboard.writeText(content).then(() => {
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
                href={(modal as Extract<ModalState, { type: "pdf" }>).data}
                download={`${modal.title}.pdf`}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                ⬇️ Download
              </a>
            )}
            {modal.type === "hl7" && (
              <button
                onClick={copyHl7}
                className={`px-3 py-1 rounded text-sm border ${
                  copied
                    ? "bg-green-100 border-green-400 text-green-700"
                    : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {copied ? "✓ Kopiert" : "📋 Kopieren"}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl px-1"
              aria-label="Schliessen"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {modal.type === "pdf" && (
            <iframe
              src={(modal as Extract<ModalState, { type: "pdf" }>).data}
              className="w-full h-full border-0"
              title={modal.title}
            />
          )}
          {modal.type === "hl7" && (
            <pre className="h-full text-xs font-mono bg-gray-950 text-green-300 p-4 whitespace-pre overflow-auto">
              {(modal as Extract<ModalState, { type: "hl7" }>).content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
