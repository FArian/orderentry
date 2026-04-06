"use client";

/**
 * OrderCreatePage — container component for the order entry workflow.
 *
 * Wires three hooks (catalog, form, documents) and owns the cross-hook
 * operations that need data from multiple domains (canSubmit, submitOrder).
 */

import { useCallback, useRef } from "react";
import { useTranslation } from "@/lib/i18n";
import { useSubmitOrder } from "@/presentation/hooks/useSubmitOrder";
import { useOrderCatalog } from "@/presentation/hooks/useOrderCatalog";
import { useOrderForm, toFhirDateTime } from "@/presentation/hooks/useOrderForm";
import { useOrderDocuments } from "@/presentation/hooks/useOrderDocuments";
import { OrderFormView } from "@/presentation/pages/OrderFormView";
import { FHIR_SYSTEMS } from "@/lib/fhir";
import type { SpecimenChoice } from "@/lib/fhir";
import { AppConfig } from "@/shared/config/AppConfig";

interface OrderCreatePageProps {
  id: string;
  srId?: string;
}

export default function OrderCreatePage({ id, srId }: OrderCreatePageProps) {
  const { t: tr, locale } = useTranslation();
  const { submitBundle } = useSubmitOrder();

  // ── Hooks ─────────────────────────────────────────────────────────────────────

  /** Stores the pool/Orchestra order number resolved during the last submit. */
  const resolvedOrderNumber = useRef<string | undefined>(undefined);

  const catalog = useOrderCatalog(AppConfig.labOrgId);
  const form = useOrderForm(
    id,
    srId,
    catalog.setSelectedTests,
    catalog.setNeedsMaterialRecompute,
    tr,
  );

  // Document context: gives useOrderDocuments everything it needs to build documents
  const docCtx = {
    patientId: id,
    patientData: form.patientData,
    selectedTests: catalog.selectedTests,
    selectedSpecimens: catalog.selectedSpecimens,
    materialsFromAnalyses: catalog.materialsFromAnalyses,
    priority: form.priority,
    collectionDate: form.collectionDate,
    requester: form.requester,
    requesterId: form.requesterId,
    encounterClass: form.encounterClass,
    clinicalNote: form.clinicalNote,
    getPatientIdentifiers: form.getPatientIdentifiers,
    generateOrderNumber: () => resolvedOrderNumber.current ?? form.generateOrderNumber(),
    locale,
    tr,
  };

  const docs = useOrderDocuments(docCtx);

  // ── Cross-hook derived state ───────────────────────────────────────────────────

  const canSubmit =
    catalog.selectedTests.length > 0 &&
    (catalog.selectedSpecimens.length > 0 ||
      Object.keys(catalog.materialsFromAnalyses).length > 0) &&
    !form.submitting;

  // ── Cross-hook operations ──────────────────────────────────────────────────────

  const submitOrder = useCallback(async () => {
    if (!canSubmit) return;
    form.setSubmitting(true);
    form.setSubmitMsg(null);
    form.setSubmitErr(null);
    try {
      // Derive service type from selected tests' topic (MIBI takes precedence over ROUTINE).
      const hasMibi = catalog.selectedTests.some(
        (t) => t.topic?.toUpperCase().includes("MIBI"),
      );
      const orderServiceType: "MIBI" | "ROUTINE" | "POC" = hasMibi ? "MIBI" : "ROUTINE";

      // Fetch a real order number from the Order Number Engine (Orchestra → Pool fallback)
      const orderNumber = await form.fetchOrderNumber(orderServiceType);
      // Store for reuse by printLabel and other document builders
      resolvedOrderNumber.current = orderNumber;
      // Reuse existing SR id when editing a draft, otherwise generate new
      const activeSrId = form.currentSrId || `sr-${orderNumber}`;
      const encId = `enc-${orderNumber}`;
      const docId = `docref-${orderNumber}`;
      const base64Pdf = docs.buildBegleitscheinBase64(orderNumber);
      const hl7Message = docs.buildHl7Preview();
      const base64Hl7 = btoa(unescape(encodeURIComponent(hl7Message)));
      const { ahv, insuranceCard } = form.getPatientIdentifiers();

      const { selectedTests, selectedSpecimens, materialsFromAnalyses } = catalog;
      const { priority, collectionDate, requester, requesterId, clinicalNote, encounterClass } = form;

      // Derive specimens from materials if no explicit specimen selection
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
          id: activeSrId,
          status: "active",
          intent: "order",
          priority,
          ...(collectionDate ? { occurrenceDateTime: toFhirDateTime(collectionDate) } : {}),
          ...(requester
            ? {
                requester: {
                  ...(requesterId ? { reference: `Practitioner/${requesterId}` } : {}),
                  display: requester,
                },
              }
            : {}),
          ...(clinicalNote ? { note: [{ text: clinicalNote }] } : {}),
          identifier: [
            { system: FHIR_SYSTEMS.orderNumbers, value: orderNumber },
            ...(ahv ? [{ system: "urn:oid:2.16.756.5.32", value: ahv }] : []),
            ...(insuranceCard
              ? [{ system: "urn:oid:2.16.756.5.30.1.123.100.1.1", value: insuranceCard }]
              : []),
          ],
          subject: { reference: `Patient/${id}` },
          encounter: { reference: `Encounter/${encId}` },
          code: {
            text:
              selectedTests.length === 1
                ? selectedTests[0]!.display || selectedTests[0]!.code
                : `${selectedTests.length} Untersuchungen`,
          },
          orderDetail: selectedTests.map((t) => ({
            coding: [{ system: t.system, code: t.code, display: t.display }],
            ...(t.topic
              ? { text: t.category ? `${t.topic} / ${t.category}` : t.topic }
              : {}),
          })),
          specimen: specimensSource.map((s) => ({
            reference: `Specimen/spec-${orderNumber}-${s.id}`,
            identifier: { system: FHIR_SYSTEMS.specimen, value: s.id },
          })),
          supportingInfo: [{ reference: `DocumentReference/${docId}` }],
        },
        request: { method: "PUT", url: `ServiceRequest/${activeSrId}` },
      } as const;

      const encounterEntry = {
        resource: {
          resourceType: "Encounter",
          id: encId,
          status: "in-progress",
          class: {
            system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            code: encounterClass,
          },
          subject: { reference: `Patient/${id}` },
        },
        request: { method: "PUT", url: `Encounter/${encId}` },
      };

      const documentReferenceEntry = {
        resource: {
          resourceType: "DocumentReference",
          id: docId,
          status: "current",
          subject: { reference: `Patient/${id}` },
          context: { related: [{ reference: `ServiceRequest/${activeSrId}` }] },
          content: [
            {
              attachment: {
                contentType: "application/pdf",
                data: base64Pdf,
                title: "Begleitschein",
                creation: new Date().toISOString(),
              },
            },
            {
              attachment: {
                contentType: "x-application/hl7-v2+er7",
                data: base64Hl7,
                title: "ORM^O01",
                creation: new Date().toISOString(),
              },
            },
          ],
        },
        request: { method: "PUT", url: `DocumentReference/${docId}` },
      };

      const bundle = {
        resourceType: "Bundle",
        type: "transaction",
        entry: [encounterEntry, serviceRequestEntry, ...specimenEntries, documentReferenceEntry],
      };

      const ids = await submitBundle(bundle as unknown as Record<string, unknown>);
      form.setSubmitMsg(`${tr("order.sent")}. IDs: ${ids.join(", ") || "ok"}`);
      form.setSubmitErr(null);

      // Queue print job for Local Agent (fire-and-forget — does not block UI)
      void fetch("/api/v1/agent/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId:               AppConfig.labOrgId,
          documentReferenceId: docId,
          serviceRequestId:    activeSrId,
          patientId:           id,
          orderNumber,
          specimens: specimensSource.map((s) => ({
            materialCode: s.id,
            materialName: s.label || s.code?.display || s.id,
          })),
        }),
      }).catch(() => {
        // Agent not available — browser print is the fallback
      });

      // Print Begleitschein before clearing state so patient/order data is still available
      docs.printBegleitschein(orderNumber);

      // Reset catalog selection state
      catalog.setSelectedTests([]);
      catalog.setSelectedSpecimens([]);
      catalog.setMaterialsFromAnalyses({});
      catalog.setAnalysisContribs({});
      form.setCurrentSrId(undefined);
      resolvedOrderNumber.current = undefined;
      try { localStorage.removeItem(`order:${id}`); } catch { /* ignore */ }
    } catch (e: unknown) {
      form.setSubmitErr(e instanceof Error ? e.message : String(e));
      form.setSubmitMsg(null);
    } finally {
      form.setSubmitting(false);
    }
  }, [
    canSubmit, form, catalog, docs, id, submitBundle, tr,
  ]);

  // ── Inactive patient guard ────────────────────────────────────────────────────

  const patientIsActive = !form.patientLoading &&
    (form.patientData as { active?: boolean } | null)?.active !== false;

  if (!form.patientLoading && !patientIsActive) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md w-full rounded-xl border border-zt-danger-border bg-zt-danger-light p-6 text-center">
          <div className="text-3xl mb-3" aria-hidden="true">🚫</div>
          <h2 className="text-base font-semibold text-zt-danger mb-2">{tr("order.inactivePatient")}</h2>
          <p className="text-sm text-zt-text-secondary mb-4">{tr("order.inactivePatientHint")}</p>
          <a
            href="/patients?q="
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-zt-bg-card border border-zt-border text-zt-text-primary hover:bg-zt-bg-page transition-colors"
          >
            ← {tr("nav.patients")}
          </a>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <OrderFormView
      patientId={id}
      catalog={catalog}
      form={form}
      docs={docs}
      tr={tr}
      canSubmit={canSubmit}
      submitOrder={submitOrder}
    />
  );
}
