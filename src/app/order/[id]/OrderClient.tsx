"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FhirCoding,
  SpecimenChoice,
  ValueSetExpansion,
  ValueSetSummary,
  ActivityDefinitionSearchBundle,
} from "@/lib/fhir";
import {
  fhirGet,
  fhirPost,
  FHIR_BASE,
  fetchActivityAndObservation,
  ObservationDefinition,
  ActivityDefinition,
  SpecimenDefinition,
  SpecimenDefinitionSearchBundle,
} from "@/lib/fhir";

// removed static tabs and local value sets; categories now come from FHIR ActivityDefinition

// no remote expansion type needed; using local catalog

type BundleEntry = { fullUrl?: string; response?: { location?: string } };

// Type guard to avoid explicit any
function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

// removed AllergyIntolerance helpers; not used in current flow

export default function OrderClient({ id }: { id: string }) {
  const [topTabs, setTopTabs] = useState<string[]>([]);
  const [selectedTopTab, setSelectedTopTab] = useState<string | null>(null);
  const [allAds, setAllAds] = useState<ActivityDefinition[]>([]);
  const [pageLoading, setPageLoading] = useState<boolean>(true);
  const [patientLoading, setPatientLoading] = useState<boolean>(true);
  const [patientData, setPatientData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [categories, setCategories] = useState<ValueSetSummary[]>([]);
  const [categoriesNotice, setCategoriesNotice] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<ValueSetSummary | null>(null);
  type MiddleItem = ValueSetExpansion & {
    specimenRef?: string;
    quantityValue?: number | string;
    quantityUnit?: string;
    // AllergyIntolerance details
    resourceId?: string;
    categories?: string[];
    criticality?: string;
    reactions?: string[];
    severity?: string;
    notes?: string[];
  };
  const [availableTests, setAvailableTests] = useState<MiddleItem[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [selectedTests, setSelectedTests] = useState<MiddleItem[]>([]);
  const [selectedSpecimens, setSelectedSpecimens] = useState<SpecimenChoice[]>(
    []
  );
  // Track per-analysis material contributions for later subtraction
  const [analysisContribs, setAnalysisContribs] = useState<
    Record<
      string,
      Array<{ specimenRef: string; num?: number; unit?: string; label: string }>
    >
  >({});

  // removed results viewer section (requested)

  const [catQuery, setCatQuery] = useState("");
  const [testQuery, setTestQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // Cache for ActivityDefinition/ObservationDefinition by coding key
  const [infoOpen, setInfoOpen] = useState<Record<string, boolean>>({});
  const [infoCache, setInfoCache] = useState<
    Record<
      string,
      {
        ad?: ActivityDefinition;
        od?: ObservationDefinition;
        sd?: SpecimenDefinition;
        minVol?: { value?: number; unit?: string; code?: string };
      }
    >
  >({});
  const [infoLoading, setInfoLoading] = useState<Record<string, boolean>>({});

  const catDebounce = useRef<number | undefined>(undefined);
  const testDebounce = useRef<number | undefined>(undefined);

  // Helper: extract topic coding display from ActivityDefinition
  const getTopicDisplay = useCallback(
    (ad: ActivityDefinition): string | undefined => {
      const t = ad.topic;
      if (Array.isArray(t)) return t[0]?.coding?.[0]?.display;
      return t?.coding?.[0]?.display;
    },
    []
  );

  // Normalize unit strings to avoid duplicate material entries due to unit variants
  const normalizeUnit = useCallback((u?: string): string | undefined => {
    if (!u) return u;
    if (u.toLowerCase() === "ul") return "µl";
    return u;
  }, []);

  // Load ActivityDefinitions once (no topic filter) and build tabs from response topics
  useEffect(() => {
    let cancelled = false;
    setCategoriesNotice(null);
    setSelectedCategory(null);

    async function load() {
      try {
        setPageLoading(true);
        // Single call without topic param; categories (tabs) derive from ActivityDefinition.topic
        const bundle = (await fhirGet(
          "/ActivityDefinition"
        )) as ActivityDefinitionSearchBundle;
        const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
        const rawAds = entries
          .map((e) => e.resource)
          .filter(
            (r): r is ActivityDefinition =>
              isObject(r) &&
              (r as { resourceType?: unknown }).resourceType ===
                "ActivityDefinition"
          );
        // Deduplicate by resource id if available
        const seen = new Set<string>();
        const ads: ActivityDefinition[] = [];
        for (const a of rawAds) {
          const id = (a as unknown as { id?: string }).id || "";
          const key =
            id ||
            JSON.stringify(
              (
                a as unknown as {
                  code?: { coding?: Array<{ system?: string; code?: string }> };
                }
              ).code?.coding?.[0] || {}
            );
          if (seen.has(key)) continue;
          seen.add(key);
          ads.push(a);
        }
        const tabsSet = new Set<string>();
        for (const ad of ads) {
          const display = getTopicDisplay(ad);
          if (display) tabsSet.add(display);
        }
        if (!cancelled) {
          setAllAds(ads);
          // Build tabs and sort so Mikrobiologie/MIBI first, Routine second
          const original = Array.from(tabsSet);
          const score = (t: string) => {
            const l = t.toLowerCase();
            if (l === "mibi" || /mikro/i.test(t)) return 0;
            if (l === "routine") return 1;
            return 2;
          };
          const tabs = original
            .map((t, i) => ({ t, i }))
            .sort((a, b) => {
              const sa = score(a.t);
              const sb = score(b.t);
              if (sa !== sb) return sa - sb;
              return a.i - b.i; // stable within same bucket
            })
            .map((x) => x.t);
          setTopTabs(tabs);
        }
      } catch {
        if (!cancelled) setCategoriesNotice("Failed to load categories");
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [getTopicDisplay]);

  // Also wait for Patient to load before removing the loading spinner
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
        // Even on error, do not block the UI indefinitely
        if (active) {
          setPatientData(null);
          setPatientLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Ensure a default top tab is selected once tabs load
  // Prefer MIBI/Mikrobiologie if present
  useEffect(() => {
    if (!selectedTopTab && topTabs.length > 0) {
      const preferred =
        topTabs.find((t) => t.toLowerCase() === "mibi") ||
        topTabs.find((t) => /mikro/i.test(t)) ||
        topTabs[0];
      setSelectedTopTab(preferred);
    }
  }, [topTabs, selectedTopTab]);

  // Restore local draft
  useEffect(() => {
    const key = `order:${id}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.selectedTests) setSelectedTests(parsed.selectedTests);
        if (parsed?.selectedSpecimens)
          setSelectedSpecimens(parsed.selectedSpecimens);
      }
    } catch {}
  }, [id]);

  const filteredCategories = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    return categories.filter((c) => {
      const label = (c.title || c.name || c.url).toLowerCase();
      return !q || label.includes(q);
    });
  }, [categories, catQuery]);

  // Build subcategories (descriptions) when top tab or ad list changes
  useEffect(() => {
    const current = selectedTopTab;
    if (!current) {
      setCategories([]);
      setCategoriesNotice("No categories available for this tab.");
      return;
    }
    const seen = new Set<string>();
    const list: ValueSetSummary[] = [];
    for (const ad of allAds) {
      const tdisp = getTopicDisplay(ad);
      if (tdisp !== current) continue;
      const desc = ad.description?.trim();
      if (!desc) continue;
      if (seen.has(desc)) continue;
      seen.add(desc);
      list.push({
        url: `fhir:subcategory:${encodeURIComponent(desc)}`,
        title: desc,
      });
    }
    setCategories(list);
    setCategoriesNotice(
      list.length === 0 ? "No categories available for this tab." : null
    );
    setSelectedCategory(null);
  }, [allAds, selectedTopTab, getTopicDisplay]);

  // Auto-select first category once categories are loaded
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      expandCategory(categories[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const filteredTests = useMemo(() => {
    const q = testQuery.trim().toLowerCase();
    return availableTests.filter((t) => {
      const label = `${t.display || ""} ${t.code}`.toLowerCase();
      return !q || label.includes(q);
    });
  }, [availableTests, testQuery]);

  const isSelected = useCallback(
    (t: MiddleItem) =>
      selectedTests.some((x) => x.system === t.system && x.code === t.code),
    [selectedTests]
  );

  const [materialsFromAnalyses, setMaterialsFromAnalyses] = useState<
    Record<string, { label: string; value?: string }>
  >({});

  // Build material volume item from current ActivityDefinition (no extra API calls)
  const getMinimalVolumeItems = useCallback(
    (
      t: MiddleItem
    ): Array<{
      specimenRef: string;
      num?: number;
      unit?: string;
      label: string;
    }> => {
      const items: Array<{
        specimenRef: string;
        num?: number;
        unit?: string;
        label: string;
      }> = [];
      const currentTab = selectedTopTab || "";
      const currentSub = (
        selectedCategory?.title ||
        selectedCategory?.name ||
        ""
      ).trim();
      for (const ad of allAds) {
        const tdisp = getTopicDisplay(ad);
        if (tdisp !== currentTab) continue;
        if ((ad.description || "").trim() !== currentSub) continue;
        const coding = ad.code?.coding?.[0];
        if (!coding || coding.system !== t.system || coding.code !== t.code)
          continue;
        const volExt = Array.isArray(ad.extension)
          ? ad.extension.find(
              (ex) =>
                (ex as { url?: string }).url ===
                "https://www.zetlab.ch/fhir/StructureDefinition/minimal-volume-microliter"
            )
          : undefined;
        const vq = (
          volExt as unknown as {
            valueQuantity?: { value?: number; unit?: string; code?: string };
          }
        )?.valueQuantity;
        const value = vq?.value;
        const unit = normalizeUnit(vq?.unit || vq?.code);
        const specExt = Array.isArray(ad.extension)
          ? ad.extension.find(
              (ex) =>
                (ex as { url?: string }).url ===
                "https://www.zetlab.ch/StructureDefinition/specimen-definition"
            )
          : undefined;
        const specId = (
          specExt as unknown as {
            valueReference?: { identifier?: { value?: string } };
          }
        )?.valueReference?.identifier?.value;
        const specimenRef = specId ? `kind:${specId}` : `kind:unknown`;
        const label = specId ? `Specimen ${specId}` : "Material";
        if (value !== undefined)
          items.push({ specimenRef, num: value, unit, label });
        break; // only the matching AD is needed
      }
      return items;
    },
    [allAds, getTopicDisplay, selectedTopTab, selectedCategory, normalizeUnit]
  );

  const toggleTest = useCallback(
    (t: MiddleItem) => {
      const existsNow = selectedTests.some(
        (x) => x.system === t.system && x.code === t.code
      );
      setSelectedTests((prev) => {
        const exists = prev.some(
          (x) => x.system === t.system && x.code === t.code
        );
        return exists
          ? prev.filter((x) => !(x.system === t.system && x.code === t.code))
          : [...prev, t];
      });

      if (!existsNow) {
        const items = getMinimalVolumeItems(t);
        if (items.length > 0) {
          const key = `${t.system}|${t.code}`;
          setAnalysisContribs((prev) => ({ ...prev, [key]: items }));
          setMaterialsFromAnalyses((prev) => {
            const next = { ...prev } as Record<
              string,
              { label: string; value?: string }
            >;
            for (const it of items) {
              const aggKey = it.specimenRef;
              const current = next[aggKey];
              if (it.num !== undefined) {
                const curNum = current?.value
                  ? Number(current.value.split(" ")[0])
                  : 0;
                const curUnit = current?.value
                  ? current.value.split(" ").slice(1).join(" ")
                  : undefined;
                const unit = normalizeUnit(it.unit || curUnit);
                const sum = (curNum || 0) + (Number(it.num) || 0);
                next[aggKey] = {
                  label: it.label,
                  value: `${sum}${unit ? ` ${unit}` : ""}`,
                };
              } else {
                next[aggKey] = { label: it.label, value: current?.value };
              }
            }
            return next;
          });
        }
      }

      // If removing, clear materials derived from this analysis code
      if (existsNow) {
        const key = `${t.system}|${t.code}`;
        const contribs = analysisContribs[key] || [];
        setMaterialsFromAnalyses((prev) => {
          const next: Record<string, { label: string; value?: string }> = {
            ...prev,
          };
          for (const it of contribs) {
            const aggKey = it.specimenRef;
            const current = next[aggKey];
            if (!current) continue;
            if (it.num !== undefined) {
              const curNum = current.value
                ? Number(current.value.split(" ")[0])
                : 0;
              const curUnit = current.value
                ? current.value.split(" ").slice(1).join(" ")
                : undefined;
              const unit = it.unit || curUnit;
              const remainder = Math.max(
                0,
                (curNum || 0) - (Number(it.num) || 0)
              );
              if (remainder > 0)
                next[aggKey] = {
                  label: current.label,
                  value: `${remainder}${unit ? ` ${unit}` : ""}`,
                };
              else delete next[aggKey];
            } else {
              if (!current.value) delete next[aggKey];
            }
          }
          return next;
        });
        setAnalysisContribs((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [selectedTests, getMinimalVolumeItems, analysisContribs, normalizeUnit]
  );

  const toggleInfo = useCallback(
    async (t: ValueSetExpansion) => {
      const key = `${t.system}|${t.code}`;
      setInfoOpen((prev) => ({ ...prev, [key]: !prev[key] }));
      if (infoCache[key] || infoLoading[key]) return;
      try {
        setInfoLoading((p) => ({ ...p, [key]: true }));
        const { activity, observation } = await fetchActivityAndObservation(
          t.system,
          t.code
        );
        // Minimal volume (uL) from ActivityDefinition.extension
        let minVol:
          | { value?: number; unit?: string; code?: string }
          | undefined;
        if (activity && Array.isArray(activity.extension)) {
          const volExt = activity.extension.find(
            (ex) =>
              ex &&
              (ex as { url?: string }).url ===
                "https://www.zetlab.ch/fhir/StructureDefinition/minimal-volume-microliter"
          );
          const vq = (
            volExt as unknown as {
              valueQuantity?: { value?: number; unit?: string; code?: string };
            }
          )?.valueQuantity;
          if (vq) minVol = { value: vq.value, unit: vq.unit, code: vq.code };
        }
        let sd: SpecimenDefinition | undefined = undefined;
        // Try to resolve SpecimenDefinition via ActivityDefinition.extension valueReference.identifier
        if (activity && Array.isArray(activity.extension)) {
          const specExt = activity.extension.find(
            (ex) =>
              ex &&
              (ex as { url?: string }).url ===
                "https://www.zetlab.ch/StructureDefinition/specimen-definition"
          );
          const idVal = (
            specExt as unknown as {
              valueReference?: { identifier?: { value?: string } };
            }
          )?.valueReference?.identifier?.value;
          if (idVal) {
            try {
              const bundle = (await fhirGet(
                `/SpecimenDefinition?identifier=${encodeURIComponent(idVal)}`
              )) as SpecimenDefinitionSearchBundle;
              const entry = Array.isArray(bundle.entry)
                ? bundle.entry.find(
                    (e) =>
                      e.resource &&
                      (e.resource as { resourceType?: string }).resourceType ===
                        "SpecimenDefinition"
                  )
                : undefined;
              if (entry && entry.resource)
                sd = entry.resource as SpecimenDefinition;
            } catch {
              // ignore specimen errors
            }
          }
        }
        setInfoCache((p) => ({
          ...p,
          [key]: { ad: activity, od: observation, sd, minVol },
        }));
      } catch {
        // swallow errors; UI remains minimal
      } finally {
        setInfoLoading((p) => ({ ...p, [key]: false }));
      }
    },
    [infoCache, infoLoading]
  );

  // Note: removed manual material loader; materials now derive from selected analyses only

  const canSubmit =
    selectedTests.length > 0 &&
    ((selectedSpecimens && selectedSpecimens.length > 0) ||
      Object.keys(materialsFromAnalyses).length > 0) &&
    !submitting;

  // Expand a ValueSet when selected
  const expandCategory = useCallback(
    async (vs: ValueSetSummary) => {
      setSelectedCategory(vs);
      setAvailableTests([]);
      setTestQuery("");
      setTestsLoading(true);
      try {
        const current = selectedTopTab || "";
        const subcat = (vs.title || vs.name || "").trim();
        const list: MiddleItem[] = [];
        const seen = new Set<string>();
        for (const ad of allAds) {
          // Filter by selected top tab (topic display) and subcategory (description)
          const tdisp = getTopicDisplay(ad);
          if (tdisp !== current) continue;
          if ((ad.description || "").trim() !== subcat) continue;
          const coding = ad.code?.coding?.[0];
          if (!coding || !coding.system || !coding.code) continue;
          const key = `${coding.system}|${coding.code}`;
          if (seen.has(key)) continue;
          seen.add(key);
          list.push({
            system: coding.system,
            code: coding.code,
            display: ad.subtitle || coding.display || coding.code,
          });
        }
        setAvailableTests(list);
      } finally {
        setTestsLoading(false);
      }
    },
    [allAds, selectedTopTab, getTopicDisplay]
  );

  // Save local draft
  const saveDraft = useCallback(() => {
    const key = `order:${id}`;
    const payload = { selectedTests, selectedSpecimens, ts: Date.now() };
    localStorage.setItem(key, JSON.stringify(payload));
    setSubmitMsg("Entwurf gespeichert (lokal)");
    setSubmitErr(null);
    window.setTimeout(() => setSubmitMsg(null), 2500);
  }, [id, selectedSpecimens, selectedTests]);

  // Extract identifiers (AHV and insurance card) from patient
  const getPatientIdentifiers = useCallback((): {
    ahv?: string;
    insuranceCard?: string;
  } => {
    const result: { ahv?: string; insuranceCard?: string } = {};
    const p = (patientData || {}) as {
      identifier?: Array<{
        system?: string;
        value?: string;
        type?: { text?: string };
      }>;
    };
    const ids = Array.isArray(p.identifier) ? p.identifier : [];
    const findId = (pred: (s: string) => boolean) =>
      ids.find((i) => pred((i.system || i.type?.text || "").toLowerCase()));
    const ahv = findId(
      (s) =>
        s.includes("2.16.756.5.32") || s.includes("ahv") || s.includes("nss")
    );
    const card = findId(
      (s) =>
        s.includes("2.16.756.5.30.1.123.100.1.1") ||
        s.includes("card") ||
        s.includes("karte")
    );
    if (ahv?.value) result.ahv = String(ahv.value).replace(/\D+/g, "");
    if (card?.value)
      result.insuranceCard = String(card.value).replace(/\s+/g, "");
    return result;
  }, [patientData]);

  // Simple order number generator: ORD-YYYYMMDD-<hhmmss>
  const generateOrderNumber = useCallback((): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    return `ORD-${y}${m}${day}-${h}${mm}${s}`;
  }, []);

  // Build and submit transaction Bundle
  const submitOrder = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitMsg(null);
    setSubmitErr(null);
    try {
      const orderNumber = generateOrderNumber();
      const srId = `sr-${orderNumber}`;
      const { ahv, insuranceCard } = getPatientIdentifiers();

      // If user did not select specimens explicitly, derive from materials
      const specimensSource: SpecimenChoice[] =
        selectedSpecimens && selectedSpecimens.length > 0
          ? selectedSpecimens
          : Object.entries(materialsFromAnalyses).map(([specRef, m]) => {
              const idPart = specRef.startsWith("kind:")
                ? specRef.slice(5) || "UNK"
                : specRef || "UNK";
              const label = m.label || idPart;
              return {
                id: idPart,
                label,
                code: { system: "", code: idPart, display: label },
              } as SpecimenChoice;
            });

      // Build Specimen entries with deterministic ids: spec-<ORD>_<SPECID>
      const specimenEntries = specimensSource.map((s) => {
        const specId = `spec-${orderNumber}_${s.id}`;
        return {
          resource: {
            resourceType: "Specimen",
            id: specId,
            status: "available",
            identifier: [
              { system: "https://zetlab.ch/fhir/specimen", value: s.id },
            ],
            type: { text: s.label || s.code?.display || s.id },
          },
          request: { method: "PUT", url: `Specimen/${specId}` },
        };
      });

      // Build a single ServiceRequest that references all selected specimens
      const serviceRequestEntry = {
        resource: {
          resourceType: "ServiceRequest",
          id: srId,
          status: "active",
          intent: "order",
          identifier: [
            {
              system: "https://zetlab.ch/fhir/order-numbers",
              value: orderNumber,
            },
            ...(ahv ? [{ system: "urn:oid:2.16.756.5.32", value: ahv }] : []),
            ...(insuranceCard
              ? [
                  {
                    system: "urn:oid:2.16.756.5.30.1.123.100.1.1",
                    value: insuranceCard,
                  },
                ]
              : []),
          ],
          subject: { reference: `Patient/${id}` },
          code: {
            text:
              selectedTests.length === 1
                ? selectedTests[0].display || selectedTests[0].code
                : `${selectedTests.length} Untersuchungen`,
          },
          specimen: specimensSource.map((s) => ({
            reference: `Specimen/spec-${orderNumber}_${s.id}`,
            identifier: {
              system: "https://zetlab.ch/fhir/specimen",
              value: s.id,
            },
          })),
        },
        request: { method: "PUT", url: `ServiceRequest/${srId}` },
      } as const;

      const bundle = {
        resourceType: "Bundle",
        type: "transaction",
        entry: [serviceRequestEntry, ...specimenEntries],
      } as const;

      const resp = await fhirPost(
        "/",
        bundle as unknown as Record<string, unknown>
      );
      let ids: string[] = [];
      if (
        isObject(resp) &&
        Array.isArray((resp as { entry?: unknown }).entry)
      ) {
        ids = (resp as { entry: BundleEntry[] }).entry
          .map((e) => e.response?.location)
          .filter((v): v is string => typeof v === "string");
      }
      setSubmitMsg(`Auftrag gesendet. IDs: ${ids.join(", ") || "ok"}`);
      setSubmitErr(null);
      setSelectedTests([]);
      setSelectedSpecimens([]);
      try {
        localStorage.removeItem(`order:${id}`);
      } catch {}
    } catch (e: unknown) {
      setSubmitErr(e instanceof Error ? e.message : String(e));
      setSubmitMsg(null);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, id, selectedSpecimens, selectedTests]);

  return (
    <div className="flex-1 flex flex-col relative">
      {(pageLoading || patientLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"
            role="status"
            aria-label="Loading"
          >
            <span className="sr-only">Loading</span>
          </div>
        </div>
      )}
      {/* Tabs */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-6 items-center">
            {topTabs.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTopTab(t)}
                className={`py-3 text-sm ${
                  t === selectedTopTab
                    ? "border-b-2 border-blue-600 text-blue-700"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {t}
              </button>
            ))}
            {topTabs.length === 0 && (
              <div className="py-3 text-sm text-gray-500">Keine Kategorien</div>
            )}
            <div className="ml-auto text-xs text-gray-400">
              FHIR: {FHIR_BASE.replace(/^https?:\/\//, "")}
            </div>
          </div>
        </div>
      </div>

      {/* Main 3 columns */}
      <div className="w-full flex-1 grid grid-cols-[18rem_minmax(0,1fr)_22rem] gap-4 p-4">
        {/* Left: Categories */}
        <div className="min-h-0 flex flex-col rounded border bg-white">
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="Kategorien suchen"
              value={catQuery}
              onChange={(e) => {
                window.clearTimeout(catDebounce.current);
                const v = e.target.value;
                catDebounce.current = window.setTimeout(
                  () => setCatQuery(v),
                  250
                );
              }}
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          {categoriesNotice && (
            <div className="px-2 py-1 text-xs text-amber-700 bg-amber-50 border-b">
              {categoriesNotice}
            </div>
          )}
          <div className="flex-1 overflow-y-scroll overflow-x-hidden">
            {filteredCategories.map((c) => {
              const label = c.title || c.name || c.url;
              const active = selectedCategory?.url === c.url;
              return (
                <button
                  key={c.url}
                  onClick={() => expandCategory(c)}
                  className={`block w-full text-left px-3 py-2 text-sm border-b hover:bg-blue-50 ${
                    active ? "bg-blue-100" : "bg-white"
                  }`}
                  title={c.url}
                >
                  <span className="block w-full truncate">{label}</span>
                </button>
              );
            })}
            {filteredCategories.length === 0 && (
              <div className="p-3 text-sm text-gray-500">Keine Kategorien</div>
            )}
          </div>
        </div>

        {/* Middle: Available tests */}
        <div className="min-h-0 flex flex-col rounded border bg-white">
          <div className="p-2 border-b flex items-center gap-2">
            <input
              type="text"
              placeholder="Analysen suchen"
              value={testQuery}
              onChange={(e) => {
                window.clearTimeout(testDebounce.current);
                const v = e.target.value;
                testDebounce.current = window.setTimeout(
                  () => setTestQuery(v),
                  250
                );
              }}
              className="w-full rounded border px-2 py-1 text-sm"
            />
            <div className="text-xs text-gray-500">
              {testsLoading ? "Lädt…" : `${availableTests.length} Tests`}
            </div>
          </div>
          <div className="flex-1 overflow-y-scroll overflow-x-hidden">
            {testsLoading && (
              <div className="p-3 text-sm text-gray-500">
                Analysen werden geladen…
              </div>
            )}
            {filteredTests.map((t) => {
              const key = `${t.system}|${t.code}`;
              const details = infoCache[key];
              const open = infoOpen[key];
              return (
                <div key={key} className="border-b">
                  <label
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                    title={`${t.display || ""} (${t.code})`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected(t)}
                      onChange={() => toggleTest(t)}
                      className="accent-blue-600"
                    />
                    <span className="flex-1 truncate">
                      {t.display || t.code}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-blue-700 hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleInfo(t);
                      }}
                    >
                      Info
                    </button>
                    <span className="text-xs text-gray-500">{t.code}</span>
                  </label>
                  {/* No inline details in middle column as requested */}
                  {open && (
                    <div className="px-3 pb-3 text-xs text-gray-700">
                      {infoLoading[key] && (
                        <div className="text-gray-500">Lade Details…</div>
                      )}
                      {!infoLoading[key] && (
                        <div className="rounded bg-gray-50 border p-2">
                          {details?.ad && (
                            <div className="mb-1">
                              <span className="font-medium">
                                ActivityDefinition:
                              </span>
                              <span className="ml-1">
                                {details.ad.title ||
                                  details.ad.name ||
                                  details.ad.id}
                              </span>
                            </div>
                          )}
                          {details?.od ? (
                            <div className="space-y-1">
                              <div>
                                <span className="font-medium">
                                  Observation:
                                </span>{" "}
                                {details.od.preferredReportName ||
                                  details.od.code?.coding?.[0]?.display ||
                                  details.od.code?.text ||
                                  details.od.id}
                              </div>
                              {details.od.quantitativeDetails?.unit && (
                                <div>
                                  <span className="font-medium">Einheit:</span>
                                  <span className="ml-1">
                                    {details.od.quantitativeDetails.unit.text ||
                                      details.od.quantitativeDetails.unit
                                        .coding?.[0]?.display ||
                                      details.od.quantitativeDetails.unit
                                        .coding?.[0]?.code}
                                  </span>
                                </div>
                              )}
                              {details.od.permittedDataType &&
                                details.od.permittedDataType.length > 0 && (
                                  <div>
                                    <span className="font-medium">
                                      Datentyp:
                                    </span>
                                    <span className="ml-1">
                                      {details.od.permittedDataType.join(", ")}
                                    </span>
                                  </div>
                                )}
                            </div>
                          ) : (
                            <div className="text-gray-500">
                              Keine ObservationDefinition gefunden.
                            </div>
                          )}
                          {details?.sd && (
                            <div className="mt-2 space-y-1">
                              <div>
                                <span className="font-medium">Material:</span>{" "}
                                {details.sd.typeCollected?.text ||
                                  details.sd.typeCollected?.coding?.[0]
                                    ?.display}
                              </div>
                              {Array.isArray(details.sd.container) &&
                                details.sd.container[0]?.description && (
                                  <div>
                                    <span className="font-medium">
                                      Behälter:
                                    </span>
                                    <span className="ml-1">
                                      {details.sd.container[0]?.description}
                                    </span>
                                  </div>
                                )}
                            </div>
                          )}
                          {details?.minVol &&
                            details.minVol.value !== undefined && (
                              <div className="mt-1">
                                <span className="font-medium">
                                  Mindestvolumen:
                                </span>
                                <span className="ml-1">
                                  {details.minVol.value}
                                  {details.minVol.unit
                                    ? ` ${details.minVol.unit}`
                                    : details.minVol.code
                                    ? ` ${details.minVol.code}`
                                    : ""}
                                </span>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {!testsLoading &&
              selectedCategory &&
              filteredTests.length === 0 && (
                <div className="p-3 text-sm text-gray-500">
                  Keine Tests für Filter
                </div>
              )}
            {!testsLoading && !selectedCategory && (
              <div className="p-3 text-sm text-gray-500">
                Bitte links eine Kategorie wählen
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected + Specimens */}
        <div className="min-h-0 flex flex-col gap-4">
          <div className="rounded border bg-white">
            <div className="px-3 py-2 border-b font-medium">
              Ausgewählte Analysen
            </div>
            <div className="p-3 flex flex-wrap gap-2">
              {selectedTests.map((t) => (
                <button
                  key={`${t.system}|${t.code}`}
                  onClick={() => toggleTest(t)}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs hover:bg-blue-200"
                  title="Entfernen"
                >
                  <span className="truncate max-w-[10rem]">
                    {t.display || t.code}
                  </span>
                  <span aria-hidden>×</span>
                </button>
              ))}
              {selectedTests.length === 0 && (
                <div className="text-sm text-gray-500">
                  Noch nichts ausgewählt
                </div>
              )}
            </div>
          </div>

          <div className="rounded border bg-white">
            <div className="px-3 py-2 border-b font-medium">
              Ausgewähltes Material
            </div>
            <div className="p-3 flex flex-col gap-2">
              {Object.keys(materialsFromAnalyses).length === 0 && (
                <div className="text-xs text-gray-500">
                  Noch kein Material (wird aus ausgewählten Analysen abgeleitet)
                </div>
              )}
              {Object.entries(materialsFromAnalyses).map(([specRef, m]) => (
                <div
                  key={specRef}
                  className="rounded border bg-indigo-50 px-2 py-1 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate">{m.label}</div>
                    {m.value && (
                      <div className="text-xs text-indigo-700 whitespace-nowrap">
                        {m.value}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Results viewer removed as requested */}
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 border-t bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          {submitMsg && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
              {submitMsg}
            </div>
          )}
          {submitErr && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
              {submitErr}
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={saveDraft}
              className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-50"
            >
              Order Speichern
            </button>
            <button
              onClick={submitOrder}
              disabled={!canSubmit}
              className={`px-4 py-2 rounded text-white ${
                canSubmit
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-blue-300 cursor-not-allowed"
              }`}
            >
              Auftrag senden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
