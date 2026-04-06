"use client";

/**
 * useOrderForm — manages patient data, form field state (priority, collection date,
 * requester, encounter class, clinical note), SR loading/draft-restore, practitioner
 * autocomplete, and draft saving.
 *
 * Cross-hook coordination: receives `setSelectedTests` and `setNeedsMaterialRecompute`
 * from useOrderCatalog so that SR restore can populate the test selection.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { FHIR_SYSTEMS } from "@/lib/fhir";
import type { MiddleItem } from "./useOrderCatalog";

// ── Constants ─────────────────────────────────────────────────────────────────

const LOCKED_STATUSES = ["completed", "revoked", "entered-in-error"];
const EXT_ENCOUNTER_CLASS = "https://www.zetlab.ch/fhir/StructureDefinition/encounter-class";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toFhirDateTime(localDt: string): string {
  if (!localDt) return "";
  const date = new Date(localDt);
  if (isNaN(date.getTime())) return localDt;
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const tzH = pad(Math.floor(absOffset / 60));
  const tzM = pad(absOffset % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${tzH}:${tzM}`
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOrderForm(
  id: string,
  srId: string | undefined,
  setSelectedTests: (tests: MiddleItem[]) => void,
  setNeedsMaterialRecompute: (v: boolean) => void,
  tr: (key: string) => string,
) {
  // Patient
  const [patientLoading, setPatientLoading] = useState<boolean>(true);
  const [patientData, setPatientData] = useState<Record<string, unknown> | null>(null);

  // Form fields
  const [priority, setPriority] = useState<"routine" | "urgent">("routine");
  const [collectionDate, setCollectionDate] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [requester, setRequester] = useState<string>("");
  const [requesterId, setRequesterId] = useState<string>("");
  const [clinicalNote, setClinicalNote] = useState<string>("");
  const [encounterClass, setEncounterClass] = useState<string>("AMB");
  const [requesterQuery, setRequesterQuery] = useState<string>("");
  const [practitioners, setPractitioners] = useState<{ id: string; name: string }[]>([]);
  const [practitionersOpen, setPractitionersOpen] = useState(false);
  const practitionerDebounce = useRef<number | undefined>(undefined);

  // Submit / draft status
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // SR editing state
  const [currentSrId, setCurrentSrId] = useState<string | undefined>(srId);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [srLoading, setSrLoading] = useState(!!srId);

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Load patient demographics
  useEffect(() => {
    let active = true;
    setPatientLoading(true);
    fetch(`/api/patients/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (!active) return;
        try {
          const json = await r.json();
          if (active) setPatientData(json);
        } catch {
          if (active) setPatientData(null);
        } finally {
          if (active) setPatientLoading(false);
        }
      })
      .catch(() => {
        if (active) { setPatientData(null); setPatientLoading(false); }
      });
    return () => { active = false; };
  }, [id]);

  // Load existing SR from FHIR, or restore local draft
  useEffect(() => {
    if (srId) {
      setSrLoading(true);
      fetch(`/api/service-requests/${srId}`)
        .then(async (res) => {
          if (!res.ok) return;
          const sr = await res.json() as Record<string, unknown>;

          // Lock check
          const status = String(sr.status || "");
          if (LOCKED_STATUSES.includes(status)) setIsReadOnly(true);

          // Priority
          const p = String(sr.priority || "");
          if (p === "routine" || p === "urgent") setPriority(p);

          // Collection date
          const odt = String(sr.occurrenceDateTime || "");
          if (odt) setCollectionDate(odt.slice(0, 16));

          // Requester
          const req = sr.requester as Record<string, unknown> | undefined;
          if (req) {
            if (typeof req.display === "string") {
              setRequester(req.display);
              setRequesterQuery(req.display);
            }
            const ref = String(req.reference || "");
            if (ref.startsWith("Practitioner/")) setRequesterId(ref.slice("Practitioner/".length));
          }

          // Clinical note
          const notes = sr.note as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(notes) && notes.length > 0) {
            setClinicalNote(String(notes[0]!.text || ""));
          }

          // Encounter class
          const exts = sr.extension as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(exts)) {
            const ec = exts.find((e) => e.url === EXT_ENCOUNTER_CLASS);
            if (ec?.valueCode) setEncounterClass(String(ec.valueCode));
          }

          // Restore selected tests → catalog hook takes ownership
          const od = sr.orderDetail as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(od) && od.length > 0) {
            const restored: MiddleItem[] = od.map((item) => {
              const codings = item.coding as Array<Record<string, unknown>> | undefined;
              const c = Array.isArray(codings) ? codings[0] : undefined;
              const text = String(item.text || "");
              const parts = text.split(" / ");
              return {
                system: String(c?.system || ""),
                code: String(c?.code || ""),
                display: String(c?.display || ""),
                topic: parts[0] || undefined,
                category: parts[1] || undefined,
              } as MiddleItem;
            });
            setSelectedTests(restored);
            setNeedsMaterialRecompute(true);
          }
        })
        .catch(() => { /* ignore load errors; form stays empty */ })
        .finally(() => setSrLoading(false));
    } else {
      // Restore local draft for new orders
      const key = `order:${id}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.selectedTests) setSelectedTests(parsed.selectedTests);
        }
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srId, id]);

  // ── Functions ─────────────────────────────────────────────────────────────────

  const getPatientIdentifiers = useCallback((): { ahv?: string; insuranceCard?: string } => {
    const result: { ahv?: string; insuranceCard?: string } = {};
    const p = (patientData || {}) as {
      identifier?: Array<{ system?: string; value?: string; type?: { text?: string } }>;
    };
    const ids = Array.isArray(p.identifier) ? p.identifier : [];
    const findId = (pred: (s: string) => boolean) =>
      ids.find((i) => pred((i.system || i.type?.text || "").toLowerCase()));
    const ahv = findId(
      (s) => s.includes("2.16.756.5.32") || s.includes("ahv") || s.includes("nss")
    );
    const card = findId(
      (s) =>
        s.includes("2.16.756.5.30.1.123.100.1.1") ||
        s.includes("card") ||
        s.includes("karte")
    );
    if (ahv?.value) result.ahv = String(ahv.value).replace(/\D+/g, "");
    if (card?.value) result.insuranceCard = String(card.value).replace(/\s+/g, "");
    return result;
  }, [patientData]);

  /** Local timestamp-based ID — used only for FHIR draft resource IDs, not for real order numbers. */
  const generateOrderNumber = useCallback((): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `ord-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }, []);

  /**
   * Fetches a real order number from the Order Number Engine.
   * Uses the patient's managing organisation GLN (from FHIR) and the given serviceType.
   * Falls back to the local timestamp generator if the API is unavailable.
   */
  const fetchOrderNumber = useCallback(async (serviceType: "MIBI" | "ROUTINE" | "POC" = "ROUTINE"): Promise<string> => {
    try {
      const managingOrg = (patientData as { managingOrganization?: { reference?: string } } | null)
        ?.managingOrganization?.reference;
      const orgFhirId = managingOrg?.split("/").pop();
      // Resolve GLN from FHIR Organisation if we have an ID
      let orgGln = "";
      if (orgFhirId) {
        const orgRes = await fetch(`/api/v1/proxy/fhir/organizations/${orgFhirId}`).catch(() => null);
        if (orgRes?.ok) {
          const org = await orgRes.json() as { identifier?: Array<{ system?: string; value?: string }> };
          const glnId = org.identifier?.find((i) => i.system?.includes("gln") || i.system?.includes("GLN"));
          orgGln = glnId?.value ?? "";
        }
      }
      const res = await fetch("/api/v1/orders/number", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgGln, serviceType, patientId: id }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        if (res.status === 503) {
          // Pool empty — surface the error so the user sees it, do not silently proceed.
          throw new Error(errBody.error ?? "Kein Nummernpool verfügbar. Bitte Administrator informieren.");
        }
        // Other API errors (4xx config/validation) — fall back to timestamp draft number.
        return generateOrderNumber();
      }
      const data = await res.json() as { orderNumber: string };
      return data.orderNumber;
    } catch (err) {
      // Re-throw pool-empty errors; swallow transient network errors with fallback.
      if (err instanceof Error && err.message.includes("Nummernpool")) throw err;
      return generateOrderNumber();
    }
  }, [patientData, id, generateOrderNumber]);

  const searchPractitioners = useCallback((q: string) => {
    window.clearTimeout(practitionerDebounce.current);
    practitionerDebounce.current = window.setTimeout(async () => {
      try {
        // Extract the patient's managing organization to scope the practitioner search.
        const managingOrg = (patientData as { managingOrganization?: { reference?: string } } | null)
          ?.managingOrganization?.reference;
        const patientOrgId = managingOrg?.split("/").pop();

        const params = new URLSearchParams({ q });
        if (patientOrgId) params.set("orgFhirId", patientOrgId);

        const res = await fetch(`/api/practitioners?${params.toString()}`);
        const json = await res.json();
        setPractitioners(json.data || []);
      } catch {
        setPractitioners([]);
      }
    }, 300);
  }, [patientData]);

  /** Save current order as a FHIR draft ServiceRequest. */
  const saveDraft = useCallback(async (selectedTests: MiddleItem[]) => {
    if (isReadOnly) return;
    setSubmitting(true);
    setSubmitMsg(null);
    setSubmitErr(null);
    try {
      const draftId = currentSrId || `sr-draft-${generateOrderNumber()}`;
      const { ahv, insuranceCard } = getPatientIdentifiers();
      const draftSr = {
        resourceType: "ServiceRequest",
        id: draftId,
        status: "draft",
        intent: "order",
        priority,
        subject: { reference: `Patient/${id}` },
        ...(collectionDate ? { occurrenceDateTime: toFhirDateTime(collectionDate) } : {}),
        ...(requester
          ? { requester: { ...(requesterId ? { reference: `Practitioner/${requesterId}` } : {}), display: requester } }
          : {}),
        ...(clinicalNote ? { note: [{ text: clinicalNote }] } : {}),
        extension: [{ url: EXT_ENCOUNTER_CLASS, valueCode: encounterClass }],
        identifier: [
          { system: FHIR_SYSTEMS.orderNumbers, value: draftId },
          ...(ahv ? [{ system: "urn:oid:2.16.756.5.32", value: ahv }] : []),
          ...(insuranceCard ? [{ system: "urn:oid:2.16.756.5.30.1.123.100.1.1", value: insuranceCard }] : []),
        ],
        code: {
          text:
            selectedTests.length === 1
              ? selectedTests[0]!.display || selectedTests[0]!.code
              : selectedTests.length > 1
              ? `${selectedTests.length} Untersuchungen`
              : "Entwurf",
        },
        orderDetail: selectedTests.map((t) => ({
          coding: [{ system: t.system, code: t.code, display: t.display }],
          ...(t.topic ? { text: t.category ? `${t.topic} / ${t.category}` : t.topic } : {}),
        })),
      };
      const res = await fetch(`/api/service-requests/${draftId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draftSr),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(String(err.error || `HTTP ${res.status}`));
      }
      setCurrentSrId(draftId);
      try { localStorage.removeItem(`order:${id}`); } catch { /* ignore */ }
      setSubmitMsg(tr("order.draftSaved"));
      setSubmitErr(null);
      window.setTimeout(() => setSubmitMsg(null), 3000);
    } catch (e: unknown) {
      setSubmitErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    isReadOnly, currentSrId, generateOrderNumber, getPatientIdentifiers,
    priority, id, collectionDate, requester, requesterId, clinicalNote, encounterClass, tr,
  ]);

  // ── Return ────────────────────────────────────────────────────────────────────

  return {
    // Patient
    patientLoading, patientData,
    // Form fields
    priority, setPriority,
    collectionDate, setCollectionDate,
    requester, setRequester,
    requesterId, setRequesterId,
    clinicalNote, setClinicalNote,
    encounterClass, setEncounterClass,
    requesterQuery, setRequesterQuery,
    practitioners, setPractitioners,
    practitionersOpen, setPractitionersOpen,
    // Submit status
    submitting, setSubmitting,
    submitMsg, setSubmitMsg,
    submitErr, setSubmitErr,
    // SR state
    currentSrId, setCurrentSrId,
    isReadOnly, srLoading,
    // Functions
    getPatientIdentifiers,
    generateOrderNumber,
    fetchOrderNumber,
    searchPractitioners,
    saveDraft,
  };
}

export type OrderForm = ReturnType<typeof useOrderForm>;
export { toFhirDateTime };
