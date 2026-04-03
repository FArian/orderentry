"use client";

/**
 * useOrderDocuments — builds printable/previewable order documents:
 * Begleitschein HTML, HL7 ORM^O01, FHIR Bundle JSON.
 * Also manages the preview modal state and print functions.
 *
 * All builder functions are plain functions (not useCallback) since they are
 * only called from event handlers — they read their inputs at call time.
 */

import { useState } from "react";
import { FHIR_BASE, FHIR_SYSTEMS } from "@/lib/fhir";
import type { SpecimenChoice } from "@/lib/fhir";
import type { MiddleItem } from "./useOrderCatalog";
import { toFhirDateTime } from "./useOrderForm";

// ── Context type passed by the container ─────────────────────────────────────

export interface OrderDocumentContext {
  patientId: string;
  patientData: Record<string, unknown> | null;
  selectedTests: MiddleItem[];
  selectedSpecimens: SpecimenChoice[];
  materialsFromAnalyses: Record<string, { label: string; value?: string }>;
  priority: "routine" | "urgent";
  collectionDate: string;
  requester: string;
  requesterId: string;
  encounterClass: string;
  clinicalNote: string;
  getPatientIdentifiers: () => { ahv?: string; insuranceCard?: string };
  generateOrderNumber: () => string;
  locale: string;
  tr: (key: string) => string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOrderDocuments(ctx: OrderDocumentContext) {
  const [previewModal, setPreviewModal] = useState<null | "fhir" | "hl7">(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewCopied, setPreviewCopied] = useState(false);

  // ── Document builders (read ctx at call time — stable enough for event handlers) ──

  function buildBegleitscheinHtml(orderNum: string): string {
    const {
      patientData: p, patientId, getPatientIdentifiers, priority,
      encounterClass, collectionDate, requester, clinicalNote,
      selectedTests, materialsFromAnalyses, locale, tr,
    } = ctx;
    const nameArr = Array.isArray((p as Record<string, unknown> | null)?.name)
      ? ((p as Record<string, unknown>).name as Array<Record<string, unknown>>)
      : [];
    const official = nameArr.find((n) => n.use === "official") || nameArr[0] || {};
    const family = String(official.family || "");
    const given = Array.isArray(official.given) ? (official.given as string[]).join(" ") : "";
    const patientName = [family, given].filter(Boolean).join(", ") || patientId;
    const birthDate = String((p as Record<string, unknown> | null)?.birthDate || "");

    const formatDate = (iso: string) => {
      if (!iso) return "—";
      const parts = iso.split("-");
      return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : iso;
    };

    const genderRaw = String((p as Record<string, unknown> | null)?.gender || "");
    const genderMap: Record<string, string> = {
      male: tr("patient.gender_male"),
      female: tr("patient.gender_female"),
      other: tr("patient.gender_other"),
      unknown: tr("patient.gender_unknown"),
    };
    const gender = genderMap[genderRaw] || "—";
    const { ahv } = getPatientIdentifiers();

    const priorityLabel =
      priority === "urgent"
        ? tr("order.priority_urgent").toUpperCase()
        : tr("order.priority_routine");
    const encounterMap: Record<string, string> = {
      AMB: tr("order.encounter_AMB"),
      IMP: tr("order.encounter_IMP"),
      EMER: tr("order.encounter_EMER"),
      SS: tr("order.encounter_SS"),
      HH: tr("order.encounter_HH"),
      VR: tr("order.encounter_VR"),
    };
    const encounterLabel = encounterMap[encounterClass] || encounterClass;
    const collectionFormatted = collectionDate
      ? (() => {
          const d = new Date(collectionDate);
          const pad = (n: number) => String(n).padStart(2, "0");
          return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        })()
      : "—";
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const printedAt = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const analysesRows = selectedTests
      .map(
        (t, i) =>
          `<tr>
          <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;">${t.code}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${t.display || t.code}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${t.category || t.topic || "—"}</td>
        </tr>`
      )
      .join("");

    const barcodeInits: string[] = [];
    barcodeInits.push(
      `JsBarcode("#bc-hdr","${orderNum}",{format:"CODE128",displayValue:true,fontSize:10,height:40,margin:2,lineColor:"#111"});`
    );

    const materialRows = Object.entries(materialsFromAnalyses)
      .map(([specRef, m]) => {
        const matCode = (specRef.startsWith("kind:") ? specRef.slice(5) : specRef) || "MAT";
        const barcodeValue = `${orderNum}-${matCode}`;
        const bcId = `bc-m-${matCode.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}`;
        barcodeInits.push(
          `JsBarcode("#${bcId}","${barcodeValue}",{format:"CODE128",displayValue:true,fontSize:10,height:36,margin:2,lineColor:"#111"});`
        );
        return `<tr>
          <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${m.label}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${m.value || "—"}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;"><svg id="${bcId}"></svg></td>
        </tr>`;
      })
      .join("");

    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="UTF-8"/>
<title>${tr("bs.title")} ${orderNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 24px; }
  h1 { font-size: 20px; font-weight: bold; margin-bottom: 2px; }
  .subtitle { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 10px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
  .field label { font-size: 11px; color: #6b7280; display: block; }
  .field span { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 4px 8px; background: #f3f4f6; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
  .badge-urgent { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
  .badge-routine { background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  .order-num { font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 0.05em; }
  .footer { margin-top: 32px; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;">
  <div>
    <h1>${tr("bs.title")}</h1>
    <div class="subtitle">${tr("bs.subtitle")}</div>
  </div>
  <div style="text-align:right;">
    <div class="order-num">${orderNum}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:2px;">${tr("bs.orderNumber")}</div>
    <svg id="bc-hdr" style="max-width:200px;display:block;margin:4px 0;"></svg>
    <div style="margin-top:4px;"><span class="${priority === "urgent" ? "badge-urgent" : "badge-routine"}">${priorityLabel}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">${tr("bs.sectionPatient")}</div>
  <div class="grid2">
    <div class="field"><label>${tr("bs.name")}</label><span>${patientName}</span></div>
    <div class="field"><label>${tr("patient.birthdate")}</label><span>${formatDate(birthDate)}</span></div>
    <div class="field"><label>${tr("patient.gender")}</label><span>${gender}</span></div>
    <div class="field"><label>${tr("patient.ahv")}</label><span>${ahv ? ahv.replace(/(\d{3})(\d{4})(\d{4})(\d{2})/, "$1.$2.$3.$4") : "—"}</span></div>
    <div class="field"><label>${tr("patient.id")}</label><span>${patientId}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">${tr("bs.sectionOrderDetails")}</div>
  <div class="grid2">
    <div class="field"><label>${tr("order.collectionDate")}</label><span>${collectionFormatted}</span></div>
    <div class="field"><label>${tr("order.encounterClass")}</label><span>${encounterLabel}</span></div>
    <div class="field"><label>${tr("order.requester")}</label><span>${requester || "—"}</span></div>
    ${clinicalNote ? `<div class="field" style="grid-column:1/-1;"><label>${tr("order.clinicalNote")}</label><span>${clinicalNote}</span></div>` : ""}
  </div>
</div>

<div class="section">
  <div class="section-title">${tr("bs.sectionAnalyses")} (${selectedTests.length})</div>
  <table>
    <thead><tr><th>${tr("bs.colNum")}</th><th>${tr("bs.colCode")}</th><th>${tr("bs.colDescription")}</th><th>${tr("bs.colCategory")}</th></tr></thead>
    <tbody>${analysesRows}</tbody>
  </table>
</div>

${materialRows ? `
<div class="section">
  <div class="section-title">${tr("bs.sectionMaterial")}</div>
  <table>
    <thead><tr><th>${tr("bs.colSpecimen")}</th><th>${tr("bs.colQuantity")}</th><th>Barcode</th></tr></thead>
    <tbody>${materialRows}</tbody>
  </table>
</div>` : ""}

<div class="footer">${tr("bs.printedAt")} ${printedAt} · z2Lab OrderEntry · ${FHIR_BASE.replace(/^https?:\/\//, "")}</div>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<script>window.addEventListener('load',function(){try{${barcodeInits.join("")}}catch(e){console.warn('Barcode error:',e);}});</script>
</body>
</html>`;
  }

  function buildBegleitscheinBase64(orderNum: string): string {
    const html = buildBegleitscheinHtml(orderNum);
    try {
      return btoa(unescape(encodeURIComponent(html)));
    } catch {
      return btoa(html.replace(/[^\x00-\x7F]/g, "?"));
    }
  }

  function buildHl7Preview(): string {
    const {
      patientData: p, patientId, getPatientIdentifiers, encounterClass,
      collectionDate, requester, materialsFromAnalyses, selectedTests,
      generateOrderNumber,
    } = ctx;
    const pad = (n: number, len = 2) => String(n).padStart(len, "0");
    const now = new Date();
    const ts =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const msgId = `${ts}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const nameArr = Array.isArray((p as Record<string, unknown> | null)?.name)
      ? ((p as Record<string, unknown>).name as Array<Record<string, unknown>>)
      : [];
    const officialName = nameArr.find((n) => n.use === "official") || nameArr[0] || {};
    const family = String(officialName.family || "");
    const givenArr = Array.isArray(officialName.given) ? (officialName.given as string[]) : [];
    const given = givenArr.join(" ");
    const birthDate = String((p as Record<string, unknown> | null)?.birthDate || "").replace(/-/g, "");
    const genderRaw = String((p as Record<string, unknown> | null)?.gender || "");
    const hl7Gender = genderRaw === "male" ? "M" : genderRaw === "female" ? "F" : "U";
    const { ahv } = getPatientIdentifiers();

    const classMap: Record<string, string> = { AMB: "O", IMP: "I", EMER: "E", SS: "S", HH: "H", VR: "T" };
    const pv1Class = classMap[encounterClass] || "O";

    const lines: string[] = [];
    lines.push(`MSH|^~\\&|ORDERENTRY|ZLZ|LIS|LAB|${ts}||ORM^O01|${msgId}|P|2.5`);
    lines.push(`PID|1||${patientId}^^^ZLZ^PI${ahv ? `~${ahv}^^^AVS^SS` : ""}||${family}^${given}||${birthDate}|${hl7Gender}`);
    lines.push(`PV1|1|${pv1Class}|||||${requester ? requester.replace(/\|/g, " ") : ""}^^^^^NPI`);

    const materialList = Object.entries(materialsFromAnalyses);
    const collDt = collectionDate
      ? collectionDate.replace(/[-T:]/g, "").slice(0, 12)
      : ts.slice(0, 12);

    selectedTests.forEach((t, i) => {
      const seqStr = pad(i + 1);
      const dept = t.topic ? t.topic.replace(/\|/g, " ") : "";
      lines.push(`ORC|NW|||||||||||${requester ? requester.replace(/\|/g, " ") : ""}^^^^^NPI`);
      lines.push(`OBR|${seqStr}||${t.code}^${(t.display || t.code).replace(/\|/g, " ")}^${t.system || "LOCAL"}||||||||||||${dept}`);
      if (materialList.length > 0) {
        const [specRef, m] = materialList[i % materialList.length]!;
        const matCode = (specRef.startsWith("kind:") ? specRef.slice(5) : specRef) || "UNK";
        const specimenId = `${msgId}-${seqStr}`;
        lines.push(`SPM|${seqStr}|^${specimenId}||${matCode}^${m.label.replace(/\|/g, " ")}^LOCAL||||||||||||${collDt}`);
      }
    });

    // Embed Begleitschein as Base64 ED in OBX
    const orderNum = generateOrderNumber();
    const base64Pdf = buildBegleitscheinBase64(orderNum);
    lines.push(`OBX|1|ED|PDF^Begleitschein^LN||^application/pdf^Base64^${base64Pdf}||||||F`);

    return lines.join("\r\n");
  }

  function buildFhirPreview(): string {
    const {
      selectedTests, selectedSpecimens, materialsFromAnalyses,
      priority, collectionDate, requester, requesterId, clinicalNote, encounterClass,
      patientId, getPatientIdentifiers, generateOrderNumber,
    } = ctx;

    const orderNumber = generateOrderNumber();
    const localSrId = `sr-${orderNumber}`;
    const encId = `enc-${orderNumber}`;
    const docId = `docref-${orderNumber}`;
    const base64Pdf = buildBegleitscheinBase64(orderNumber);
    const hl7Message = buildHl7Preview();
    const base64Hl7 = btoa(unescape(encodeURIComponent(hl7Message)));
    const { ahv, insuranceCard } = getPatientIdentifiers();

    const specimensSource: SpecimenChoice[] =
      selectedSpecimens && selectedSpecimens.length > 0
        ? selectedSpecimens
        : Object.entries(materialsFromAnalyses).map(([specRef, m]) => {
            const idPart = specRef.startsWith("kind:") ? specRef.slice(5) || "UNK" : specRef || "UNK";
            const label = m.label || idPart;
            return { id: idPart, label, code: { system: "", code: idPart, display: label } } as SpecimenChoice;
          });

    const specimenEntries = specimensSource.map((s) => {
      const specId = `spec-${orderNumber}-${s.id}`;
      return {
        resource: {
          resourceType: "Specimen",
          id: specId,
          status: "available",
          identifier: [{ system: FHIR_SYSTEMS.specimen, value: s.id }],
          type: { text: s.label || s.code?.display || s.id },
        },
        request: { method: "PUT", url: `Specimen/${specId}` },
      };
    });

    const serviceRequestEntry = {
      resource: {
        resourceType: "ServiceRequest",
        id: localSrId,
        status: "active",
        intent: "order",
        priority,
        ...(collectionDate ? { occurrenceDateTime: toFhirDateTime(collectionDate) } : {}),
        ...(requester
          ? { requester: { ...(requesterId ? { reference: `Practitioner/${requesterId}` } : {}), display: requester } }
          : {}),
        ...(clinicalNote ? { note: [{ text: clinicalNote }] } : {}),
        identifier: [
          { system: FHIR_SYSTEMS.orderNumbers, value: orderNumber },
          ...(ahv ? [{ system: "urn:oid:2.16.756.5.32", value: ahv }] : []),
          ...(insuranceCard ? [{ system: "urn:oid:2.16.756.5.30.1.123.100.1.1", value: insuranceCard }] : []),
        ],
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encId}` },
        code: {
          text:
            selectedTests.length === 1
              ? selectedTests[0]!.display || selectedTests[0]!.code
              : `${selectedTests.length} Untersuchungen`,
        },
        orderDetail: selectedTests.map((t) => ({
          coding: [{ system: t.system, code: t.code, display: t.display }],
          ...(t.topic ? { text: t.category ? `${t.topic} / ${t.category}` : t.topic } : {}),
        })),
        specimen: specimensSource.map((s) => ({
          reference: `Specimen/spec-${orderNumber}-${s.id}`,
          identifier: { system: FHIR_SYSTEMS.specimen, value: s.id },
        })),
        supportingInfo: [{ reference: `DocumentReference/${docId}` }],
      },
      request: { method: "PUT", url: `ServiceRequest/${localSrId}` },
    };

    const encounterEntry = {
      resource: {
        resourceType: "Encounter",
        id: encId,
        status: "in-progress",
        class: {
          system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          code: encounterClass,
        },
        subject: { reference: `Patient/${patientId}` },
      },
      request: { method: "PUT", url: `Encounter/${encId}` },
    };

    const documentReferenceEntry = {
      resource: {
        resourceType: "DocumentReference",
        id: docId,
        status: "current",
        subject: { reference: `Patient/${patientId}` },
        context: { related: [{ reference: `ServiceRequest/${localSrId}` }] },
        content: [
          { attachment: { contentType: "application/pdf", data: base64Pdf, title: "Begleitschein", creation: new Date().toISOString() } },
          { attachment: { contentType: "x-application/hl7-v2+er7", data: base64Hl7, title: "ORM^O01", creation: new Date().toISOString() } },
        ],
      },
      request: { method: "PUT", url: `DocumentReference/${docId}` },
    };

    const bundle = {
      resourceType: "Bundle",
      type: "transaction",
      entry: [encounterEntry, serviceRequestEntry, ...specimenEntries, documentReferenceEntry],
    };
    return JSON.stringify(bundle, null, 2);
  }

  // ── Exposed actions ───────────────────────────────────────────────────────────

  function openPreview(type: "fhir" | "hl7") {
    const content = type === "fhir" ? buildFhirPreview() : buildHl7Preview();
    setPreviewContent(content);
    setPreviewModal(type);
    setPreviewCopied(false);
  }

  function copyPreview() {
    navigator.clipboard.writeText(previewContent).then(() => {
      setPreviewCopied(true);
      setTimeout(() => setPreviewCopied(false), 2000);
    });
  }

  function printBegleitschein(orderNum: string) {
    const html = buildBegleitscheinHtml(orderNum);
    const win = window.open("", "_blank", "width=860,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  function printLabel() {
    const { patientData: p, patientId, getPatientIdentifiers, materialsFromAnalyses, locale, generateOrderNumber } = ctx;
    const nameArr = Array.isArray((p as Record<string, unknown> | null)?.name)
      ? ((p as Record<string, unknown>).name as Array<Record<string, unknown>>)
      : [];
    const official = nameArr.find((n) => n.use === "official") || nameArr[0] || {};
    const family = String(official.family || "");
    const given = Array.isArray(official.given) ? (official.given as string[]).join(" ") : "";
    const patientName = [family, given].filter(Boolean).join(", ") || patientId;
    const birthDate = String((p as Record<string, unknown> | null)?.birthDate || "");
    const formatDate = (iso: string) => {
      if (!iso) return "—";
      const parts = iso.split("-");
      return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : iso;
    };
    const { ahv } = getPatientIdentifiers();
    const labelOrderNum = generateOrderNumber();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const ts = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const matEntries = Object.entries(materialsFromAnalyses);
    const labelsSource: [string, { label: string; value?: string }][] =
      matEntries.length > 0 ? matEntries : [["", { label: "" }]];

    const barcodeInits: string[] = [];
    const labelDivs = labelsSource.map(([specRef, m]) => {
      const matCode = specRef.startsWith("kind:") ? specRef.slice(5) : specRef;
      const barcodeValue = matCode ? `${labelOrderNum}-${matCode}` : labelOrderNum;
      const bcId = `bc-${(matCode || "ord").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "ord"}`;
      barcodeInits.push(
        `JsBarcode("#${bcId}","${barcodeValue}",{format:"CODE128",displayValue:true,fontSize:11,height:48,margin:2,lineColor:"#000"});`
      );
      return `<div class="label">
  <div class="patient-name">${patientName}</div>
  <div class="dob">*${formatDate(birthDate)}${ahv ? ` · AHV: ${ahv.replace(/(\d{3})(\d{4})(\d{4})(\d{2})/, "$1.$2.$3.$4")}` : ""}</div>
  <svg id="${bcId}" style="width:100%;display:block;margin:4px 0;"></svg>
  ${m.label ? `<div class="mat-label">${m.label}${m.value ? ` · ${m.value}` : ""}</div>` : ""}
  <div class="meta">ID: ${patientId} · ${ts} · ZLZ</div>
</div>`;
    }).join("\n");

    const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="UTF-8"/>
<title>Etikett ${labelOrderNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
  .label { width: 62mm; border: 1px solid #111; padding: 8px 10px; page-break-after: always; }
  .patient-name { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
  .dob { font-size: 11px; color: #374151; margin-bottom: 4px; }
  .mat-label { font-size: 11px; color: #374151; margin-top: 2px; }
  .meta { font-size: 9px; color: #9ca3af; margin-top: 4px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
${labelDivs}
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<script>window.addEventListener('load',function(){try{${barcodeInits.join("")}}catch(e){console.warn('Barcode error:',e);}});</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  // ── Return ────────────────────────────────────────────────────────────────────

  return {
    previewModal, setPreviewModal,
    previewContent, previewCopied,
    openPreview, copyPreview,
    printBegleitschein, printLabel,
    buildBegleitscheinBase64, buildHl7Preview, buildFhirPreview,
  };
}

export type OrderDocuments = ReturnType<typeof useOrderDocuments>;
