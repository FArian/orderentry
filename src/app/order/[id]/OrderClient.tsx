"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type {
  SpecimenChoice,
  ValueSetExpansion,
  ValueSetSummary,
  ActivityDefinitionSearchBundle,
} from "@/lib/fhir";
import {
  fhirGet,
  fhirPost,
  FHIR_BASE,
  FHIR_SYSTEMS,
  FHIR_EXT,
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

// Convert datetime-local value ("YYYY-MM-DDTHH:mm") to FHIR-compliant datetime
// with seconds and local timezone offset: "2026-03-31T00:17:00+01:00"
function toFhirDateTime(localDt: string): string {
  if (!localDt) return "";
  const date = new Date(localDt);
  if (isNaN(date.getTime())) return localDt;
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = -date.getTimezoneOffset(); // minutes
  const sign = offset >= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const tzH = pad(Math.floor(absOffset / 60));
  const tzM = pad(absOffset % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${tzH}:${tzM}`
  );
}

// removed AllergyIntolerance helpers; not used in current flow

const LOCKED_STATUSES = ["completed", "revoked", "entered-in-error"];
const EXT_ENCOUNTER_CLASS = "https://www.zetlab.ch/fhir/StructureDefinition/encounter-class";

export default function OrderClient({ id, srId }: { id: string; srId?: string }) {
  // tr = translation function; local map callbacks use 't' as variable name
  const { t: tr } = useTranslation();
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
    /** Top-level department tab from ActivityDefinition.topic (e.g. "Routine", "Mikrobiologie", "POCT") */
    topic?: string;
    /** Subcategory from ActivityDefinition.description (e.g. "Hämatologie", "Klinische Chemie") */
    category?: string;
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
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<null | "fhir" | "hl7">(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewCopied, setPreviewCopied] = useState(false);

  // Draft / SR editing state
  const [currentSrId, setCurrentSrId] = useState<string | undefined>(srId);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [srLoading, setSrLoading] = useState(!!srId);
  const [needsMaterialRecompute, setNeedsMaterialRecompute] = useState(false);

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

  // Load existing SR from FHIR when srId is provided, otherwise restore local draft
  useEffect(() => {
    if (srId) {
      setSrLoading(true);
      fetch(`/api/service-requests/${srId}`)
        .then(async (res) => {
          if (!res.ok) return;
          const sr = await res.json() as Record<string, unknown>;
          // Lock check
          const status = String(sr.status || "");
          if (LOCKED_STATUSES.includes(status)) {
            setIsReadOnly(true);
          }
          // Restore priority
          const p = String(sr.priority || "");
          if (p === "routine" || p === "urgent") setPriority(p);
          // Restore collection date
          const odt = String(sr.occurrenceDateTime || "");
          if (odt) {
            // Convert FHIR datetime to datetime-local format (YYYY-MM-DDTHH:mm)
            setCollectionDate(odt.slice(0, 16));
          }
          // Restore requester
          const req = sr.requester as Record<string, unknown> | undefined;
          if (req) {
            if (typeof req.display === "string") {
              setRequester(req.display);
              setRequesterQuery(req.display);
            }
            const ref = String(req.reference || "");
            if (ref.startsWith("Practitioner/")) setRequesterId(ref.slice("Practitioner/".length));
          }
          // Restore clinical note
          const notes = sr.note as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(notes) && notes.length > 0) {
            setClinicalNote(String(notes[0].text || ""));
          }
          // Restore encounter class from extension
          const exts = sr.extension as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(exts)) {
            const ec = exts.find((e) => e.url === EXT_ENCOUNTER_CLASS);
            if (ec?.valueCode) setEncounterClass(String(ec.valueCode));
          }
          // Restore selected tests from orderDetail
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
        .catch(() => {/* ignore load errors, form stays empty */})
        .finally(() => setSrLoading(false));
    } else {
      // Restore local draft for new orders
      const key = `order:${id}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.selectedTests) setSelectedTests(parsed.selectedTests);
          if (parsed?.selectedSpecimens) setSelectedSpecimens(parsed.selectedSpecimens);
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srId, id]);

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
                FHIR_EXT.minimalVolume
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
                FHIR_EXT.specimenDefinition
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

  // Variant of getMinimalVolumeItems that uses the test's own topic/category fields
  // (used when recomputing materials after loading a draft where tab/category state isn't set)
  const getMinimalVolumeItemsByTest = useCallback(
    (t: MiddleItem): Array<{ specimenRef: string; num?: number; unit?: string; label: string }> => {
      const items: Array<{ specimenRef: string; num?: number; unit?: string; label: string }> = [];
      const topic = t.topic || "";
      const category = t.category || "";
      for (const ad of allAds) {
        const tdisp = getTopicDisplay(ad);
        if (tdisp !== topic) continue;
        if ((ad.description || "").trim() !== category) continue;
        const coding = ad.code?.coding?.[0];
        if (!coding || coding.system !== t.system || coding.code !== t.code) continue;
        const volExt = Array.isArray(ad.extension)
          ? ad.extension.find((ex) => (ex as { url?: string }).url === FHIR_EXT.minimalVolume)
          : undefined;
        const vq = (volExt as unknown as { valueQuantity?: { value?: number; unit?: string; code?: string } })?.valueQuantity;
        const value = vq?.value;
        const unit = normalizeUnit(vq?.unit || vq?.code);
        const specExt = Array.isArray(ad.extension)
          ? ad.extension.find((ex) => (ex as { url?: string }).url === FHIR_EXT.specimenDefinition)
          : undefined;
        const specId = (specExt as unknown as { valueReference?: { identifier?: { value?: string } } })?.valueReference?.identifier?.value;
        const specimenRef = specId ? `kind:${specId}` : `kind:unknown`;
        const label = specId ? `Specimen ${specId}` : "Material";
        if (value !== undefined) items.push({ specimenRef, num: value, unit, label });
        break;
      }
      return items;
    },
    [allAds, getTopicDisplay, normalizeUnit]
  );

  // After allAds loads, recompute materials for tests restored from a draft SR
  useEffect(() => {
    if (!needsMaterialRecompute || allAds.length === 0 || selectedTests.length === 0) return;
    setNeedsMaterialRecompute(false);
    const newMaterials: Record<string, { label: string; value?: string }> = {};
    const newContribs: Record<string, Array<{ specimenRef: string; num?: number; unit?: string; label: string }>> = {};
    for (const t of selectedTests) {
      const items = getMinimalVolumeItemsByTest(t);
      if (items.length === 0) continue;
      const key = `${t.system}|${t.code}`;
      newContribs[key] = items;
      for (const it of items) {
        const aggKey = it.specimenRef;
        const current = newMaterials[aggKey];
        if (it.num !== undefined) {
          const curNum = current?.value ? Number(current.value.split(" ")[0]) : 0;
          const curUnit = current?.value ? current.value.split(" ").slice(1).join(" ") : undefined;
          const unit = normalizeUnit(it.unit || curUnit);
          const sum = (curNum || 0) + (Number(it.num) || 0);
          newMaterials[aggKey] = { label: it.label, value: `${sum}${unit ? ` ${unit}` : ""}` };
        } else {
          newMaterials[aggKey] = { label: it.label, value: current?.value };
        }
      }
    }
    setMaterialsFromAnalyses(newMaterials);
    setAnalysisContribs(newContribs);
  }, [needsMaterialRecompute, allAds, selectedTests, getMinimalVolumeItemsByTest, normalizeUnit]);

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
                FHIR_EXT.minimalVolume
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
                FHIR_EXT.specimenDefinition
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

  const searchPractitioners = useCallback((q: string) => {
    window.clearTimeout(practitionerDebounce.current);
    practitionerDebounce.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/practitioners?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setPractitioners(json.data || []);
      } catch {
        setPractitioners([]);
      }
    }, 300);
  }, []);

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
            topic: tdisp || undefined,
            category: subcat || undefined,
          });
        }
        setAvailableTests(list);
      } finally {
        setTestsLoading(false);
      }
    },
    [allAds, selectedTopTab, getTopicDisplay]
  );

  // Save draft to FHIR (status: draft)
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

  // Simple order number generator: ord-YYYYMMDD-<hhmmss>
  const generateOrderNumber = useCallback((): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    return `ord-${y}${m}${day}-${h}${mm}${s}`;
  }, []);

  // Save draft to FHIR (status: draft)
  const saveDraft = useCallback(async () => {
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
        extension: [
          { url: EXT_ENCOUNTER_CLASS, valueCode: encounterClass },
        ],
        identifier: [
          { system: FHIR_SYSTEMS.orderNumbers, value: draftId },
          ...(ahv ? [{ system: "urn:oid:2.16.756.5.32", value: ahv }] : []),
          ...(insuranceCard ? [{ system: "urn:oid:2.16.756.5.30.1.123.100.1.1", value: insuranceCard }] : []),
        ],
        code: {
          text: selectedTests.length === 1
            ? selectedTests[0].display || selectedTests[0].code
            : selectedTests.length > 1 ? `${selectedTests.length} Untersuchungen` : "Entwurf",
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
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(String(err.error || `HTTP ${res.status}`));
      }
      setCurrentSrId(draftId);
      try { localStorage.removeItem(`order:${id}`); } catch {}
      setSubmitMsg(tr("order.draftSaved"));
      setSubmitErr(null);
      window.setTimeout(() => setSubmitMsg(null), 3000);
    } catch (e: unknown) {
      setSubmitErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [isReadOnly, currentSrId, generateOrderNumber, getPatientIdentifiers, priority, id, collectionDate, requester, requesterId, clinicalNote, encounterClass, selectedTests, tr]);

  // Build FHIR Bundle preview (same logic as submit, but returns JSON string)
  const buildFhirPreview = useCallback((): string => {
    const orderNumber = generateOrderNumber();
    const srId = `sr-${orderNumber}`;
    const encId = `enc-${orderNumber}`;
    const { ahv, insuranceCard } = getPatientIdentifiers();
    const specimensSource: SpecimenChoice[] =
      selectedSpecimens && selectedSpecimens.length > 0
        ? selectedSpecimens
        : Object.entries(materialsFromAnalyses).map(([specRef, m]) => {
            const idPart = specRef.startsWith("kind:")
              ? specRef.slice(5) || "UNK"
              : specRef || "UNK";
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
        id: srId,
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
        subject: { reference: `Patient/${id}` },
        encounter: { reference: `Encounter/${encId}` },
        code: {
          text: selectedTests.length === 1
            ? selectedTests[0].display || selectedTests[0].code
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
      },
      request: { method: "PUT", url: `ServiceRequest/${srId}` },
    };
    const encounterEntry = {
      resource: {
        resourceType: "Encounter",
        id: encId,
        status: "in-progress",
        class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: encounterClass },
        subject: { reference: `Patient/${id}` },
      },
      request: { method: "PUT", url: `Encounter/${encId}` },
    };
    const bundle = { resourceType: "Bundle", type: "transaction", entry: [encounterEntry, serviceRequestEntry, ...specimenEntries] };
    return JSON.stringify(bundle, null, 2);
  }, [clinicalNote, collectionDate, encounterClass, generateOrderNumber, getPatientIdentifiers, id, materialsFromAnalyses, priority, requesterId, requester, selectedSpecimens, selectedTests]);

  // Build HL7 ORM^O01 preview
  const buildHl7Preview = useCallback((): string => {
    const pad = (n: number, len = 2) => String(n).padStart(len, "0");
    const now = new Date();
    const ts =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const msgId = `${ts}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Patient fields
    const p = patientData as Record<string, unknown> | null;
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
    const pidId = String(id);

    // PV1 class mapping
    const classMap: Record<string, string> = { AMB: "O", IMP: "I", EMER: "E", SS: "S", HH: "H", VR: "T" };
    const pv1Class = classMap[encounterClass] || "O";

    const lines: string[] = [];
    lines.push(`MSH|^~\\&|ORDERENTRY|ZLZ|LIS|LAB|${ts}||ORM^O01|${msgId}|P|2.5`);
    lines.push(`PID|1||${pidId}^^^ZLZ^PI${ahv ? `~${ahv}^^^AVS^SS` : ""}||${family}^${given}||${birthDate}|${hl7Gender}`);
    lines.push(`PV1|1|${pv1Class}|||||${requester ? requester.replace(/\|/g, " ") : ""}^^^^^NPI`);

    selectedTests.forEach((t, i) => {
      const seqStr = pad(i + 1);
      const dept = t.topic ? t.topic.replace(/\|/g, " ") : "";
      lines.push(`ORC|NW|||||||||||${requester ? requester.replace(/\|/g, " ") : ""}^^^^^NPI`);
      lines.push(`OBR|${seqStr}||${t.code}^${(t.display || t.code).replace(/\|/g, " ")}^${t.system || "LOCAL"}||||||||||||${dept}`);
    });

    return lines.join("\r\n");
  }, [encounterClass, getPatientIdentifiers, id, patientData, requester, selectedTests]);

  const openPreview = useCallback((type: "fhir" | "hl7") => {
    const content = type === "fhir" ? buildFhirPreview() : buildHl7Preview();
    setPreviewContent(content);
    setPreviewModal(type);
    setPreviewCopied(false);
  }, [buildFhirPreview, buildHl7Preview]);

  const copyPreview = useCallback(() => {
    navigator.clipboard.writeText(previewContent).then(() => {
      setPreviewCopied(true);
      setTimeout(() => setPreviewCopied(false), 2000);
    });
  }, [previewContent]);

  // Build and submit transaction Bundle
  const submitOrder = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitMsg(null);
    setSubmitErr(null);
    try {
      const orderNumber = generateOrderNumber();
      // Reuse existing SR id when editing a draft, otherwise generate new
      const srId = currentSrId || `sr-${orderNumber}`;
      const encId = `enc-${orderNumber}`;
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

      // Build Specimen entries with deterministic ids: spec-<ORD>-<SPECID>
      const specimenEntries = specimensSource.map((s) => {
        const specId = `spec-${orderNumber}-${s.id}`;
        return {
          resource: {
            resourceType: "Specimen",
            id: specId,
            status: "available",
            identifier: [
              { system: FHIR_SYSTEMS.specimen, value: s.id },
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
            {
              system: FHIR_SYSTEMS.orderNumbers,
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
          encounter: { reference: `Encounter/${encId}` },
          code: {
            text:
              selectedTests.length === 1
                ? selectedTests[0].display || selectedTests[0].code
                : `${selectedTests.length} Untersuchungen`,
          },
          orderDetail: selectedTests.map((t) => ({
            coding: [{ system: t.system, code: t.code, display: t.display }],
            // text encodes department / subcategory for Orchestra routing (e.g. OBR-24)
            ...(t.topic
              ? { text: t.category ? `${t.topic} / ${t.category}` : t.topic }
              : {}),
          })),
          specimen: specimensSource.map((s) => ({
            reference: `Specimen/spec-${orderNumber}-${s.id}`,
            identifier: {
              system: FHIR_SYSTEMS.specimen,
              value: s.id,
            },
          })),
        },
        request: { method: "PUT", url: `ServiceRequest/${srId}` },
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

      const bundle = {
        resourceType: "Bundle",
        type: "transaction",
        entry: [encounterEntry, serviceRequestEntry, ...specimenEntries],
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
      setSubmitMsg(`${tr("order.sent")}. IDs: ${ids.join(", ") || "ok"}`);
      setSubmitErr(null);
      setSelectedTests([]);
      setSelectedSpecimens([]);
      setMaterialsFromAnalyses({});
      setAnalysisContribs({});
      setCurrentSrId(undefined);
      try { localStorage.removeItem(`order:${id}`); } catch {}
    } catch (e: unknown) {
      setSubmitErr(e instanceof Error ? e.message : String(e));
      setSubmitMsg(null);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, currentSrId, id, selectedSpecimens, selectedTests]);

  return (
    <div className="flex-1 flex flex-col relative">
      {(pageLoading || patientLoading || srLoading) && (
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
      {isReadOnly && (
        <div className="mx-4 mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {tr("order.readOnly")}
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
              <div className="py-3 text-sm text-gray-500">{tr("order.noCategories")}</div>
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
              placeholder={tr("order.searchCategories")}
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
              <div className="p-3 text-sm text-gray-500">{tr("order.noCategories")}</div>
            )}
          </div>
        </div>

        {/* Middle: Available tests */}
        <div className="min-h-0 flex flex-col rounded border bg-white">
          <div className="p-2 border-b flex items-center gap-2">
            <input
              type="text"
              placeholder={tr("order.searchTests")}
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
              {testsLoading ? tr("common.loading") : `${availableTests.length} ${tr("order.tests")}`}
            </div>
          </div>
          <div className="flex-1 overflow-y-scroll overflow-x-hidden">
            {testsLoading && (
              <div className="p-3 text-sm text-gray-500">
                {tr("common.loading")}
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
                        <div className="text-gray-500">{tr("common.loading")}</div>
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
                                  {tr("order.observation")}:
                                </span>{" "}
                                {details.od.preferredReportName ||
                                  details.od.code?.coding?.[0]?.display ||
                                  details.od.code?.text ||
                                  details.od.id}
                              </div>
                              {details.od.quantitativeDetails?.unit && (
                                <div>
                                  <span className="font-medium">{tr("order.unit")}:</span>
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
                                      {tr("order.datatype")}:
                                    </span>
                                    <span className="ml-1">
                                      {details.od.permittedDataType.join(", ")}
                                    </span>
                                  </div>
                                )}
                            </div>
                          ) : (
                            <div className="text-gray-500">
                              {tr("order.noObservation")}
                            </div>
                          )}
                          {details?.sd && (
                            <div className="mt-2 space-y-1">
                              <div>
                                <span className="font-medium">{tr("order.material")}:</span>{" "}
                                {details.sd.typeCollected?.text ||
                                  details.sd.typeCollected?.coding?.[0]
                                    ?.display}
                              </div>
                              {Array.isArray(details.sd.container) &&
                                details.sd.container[0]?.description && (
                                  <div>
                                    <span className="font-medium">
                                      {tr("order.container")}:
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
                                  {tr("order.minVolume")}:
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
              {tr("order.selectedTests")}
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
                  {tr("order.noTests")}
                </div>
              )}
            </div>
          </div>

          <div className="rounded border bg-white">
            <div className="px-3 py-2 border-b font-medium">
              {tr("order.selectedMaterial")}
            </div>
            <div className="p-3 flex flex-col gap-2">
              {Object.keys(materialsFromAnalyses).length === 0 && (
                <div className="text-xs text-gray-500">
                  {tr("order.noMaterial")}
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

          {/* Auftragsdetails */}
          <div className="rounded border bg-white">
            <div className="px-3 py-2 border-b font-medium text-sm">{tr("order.details")}</div>
            <div className="p-3 flex flex-col gap-3">

              {/* Priorität */}
              <div>
                <div className="text-xs text-gray-500 mb-1">{tr("order.priority")}</div>
                <div className="flex rounded border overflow-hidden">
                  <button
                    onClick={() => setPriority("routine")}
                    className={`flex-1 px-3 py-2 text-sm font-medium ${
                      priority === "routine"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {tr("order.priority_routine")}
                  </button>
                  <button
                    onClick={() => setPriority("urgent")}
                    className={`flex-1 px-3 py-2 text-sm font-medium border-l ${
                      priority === "urgent"
                        ? "bg-red-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {tr("order.priority_urgent")}
                  </button>
                </div>
              </div>

              {/* Entnahmedatum */}
              <div>
                <div className="text-xs text-gray-500 mb-1">{tr("order.collectionDate")}</div>
                <input
                  type="datetime-local"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm text-gray-700"
                />
              </div>

              {/* Zuweisender Arzt */}
              <div className="relative">
                <div className="text-xs text-gray-500 mb-1">{tr("order.requester")}</div>
                <input
                  type="text"
                  value={requesterQuery}
                  onChange={(e) => {
                    setRequesterQuery(e.target.value);
                    setRequester("");
                    setRequesterId("");
                    setPractitionersOpen(true);
                    searchPractitioners(e.target.value);
                  }}
                  onFocus={() => { setPractitionersOpen(true); searchPractitioners(requesterQuery); }}
                  onBlur={() => window.setTimeout(() => setPractitionersOpen(false), 150)}
                  placeholder={tr("order.requesterPlaceholder")}
                  className="w-full rounded border px-2 py-1.5 text-sm text-gray-700"
                />
                {requester && (
                  <div className="mt-1 flex items-center justify-between rounded bg-blue-50 border border-blue-200 px-2 py-1 text-xs text-blue-800">
                    <span>{requester}</span>
                    <button
                      type="button"
                      onClick={() => { setRequester(""); setRequesterId(""); setRequesterQuery(""); }}
                      className="ml-2 text-blue-400 hover:text-blue-700"
                    >×</button>
                  </div>
                )}
                {practitionersOpen && practitioners.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border rounded shadow-lg z-50 max-h-48 overflow-y-auto">
                    {practitioners.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => {
                          setRequester(p.name);
                          setRequesterId(p.id);
                          setRequesterQuery(p.name);
                          setPractitionersOpen(false);
                        }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Aufenthaltstyp */}
              <div>
                <div className="text-xs text-gray-500 mb-1">{tr("order.encounterClass")}</div>
                <select
                  value={encounterClass}
                  onChange={(e) => setEncounterClass(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm text-gray-700"
                >
                  <option value="AMB">{tr("order.encounter_AMB")}</option>
                  <option value="IMP">{tr("order.encounter_IMP")}</option>
                  <option value="EMER">{tr("order.encounter_EMER")}</option>
                  <option value="SS">{tr("order.encounter_SS")}</option>
                  <option value="HH">{tr("order.encounter_HH")}</option>
                  <option value="VR">{tr("order.encounter_VR")}</option>
                </select>
              </div>

              {/* Klinische Indikation */}
              <div>
                <div className="text-xs text-gray-500 mb-1">{tr("order.clinicalNote")}</div>
                <textarea
                  value={clinicalNote}
                  onChange={(e) => setClinicalNote(e.target.value)}
                  placeholder={tr("order.clinicalNotePlaceholder")}
                  rows={3}
                  className="w-full rounded border px-2 py-1.5 text-sm text-gray-700 resize-none"
                />
              </div>

            </div>
          </div>

          {/* Results viewer removed as requested */}
        </div>
      </div>

      {/* Preview Modal */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl flex flex-col"
            style={{ width: "860px", maxWidth: "95vw", height: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="font-semibold text-gray-800">
                {previewModal === "fhir" ? tr("order.fhirPreview") : tr("order.hl7Preview")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyPreview}
                  className={`px-3 py-1 rounded text-sm border ${
                    previewCopied
                      ? "bg-green-100 border-green-400 text-green-700"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {previewCopied ? "✓ Kopiert" : "📋 Kopieren"}
                </button>
                <button
                  onClick={() => setPreviewModal(null)}
                  className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1"
                  title="Schließen"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-0">
              <pre className="h-full text-xs font-mono bg-gray-950 text-green-300 p-4 whitespace-pre overflow-auto">
                {previewContent}
              </pre>
            </div>
          </div>
        </div>
      )}

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
              onClick={() => openPreview("fhir")}
              disabled={selectedTests.length === 0}
              title="FHIR Bundle als JSON anzeigen"
              className={`px-3 py-2 rounded border text-sm ${
                selectedTests.length > 0
                  ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                  : "border-gray-200 text-gray-300 cursor-not-allowed"
              }`}
            >
              {tr("order.fhirPreview")}
            </button>
            <button
              onClick={() => openPreview("hl7")}
              disabled={selectedTests.length === 0}
              title="HL7 ORM^O01 Nachricht anzeigen"
              className={`px-3 py-2 rounded border text-sm ${
                selectedTests.length > 0
                  ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                  : "border-gray-200 text-gray-300 cursor-not-allowed"
              }`}
            >
              {tr("order.hl7Preview")}
            </button>
            {!isReadOnly && (
              <>
                <button
                  onClick={saveDraft}
                  disabled={submitting}
                  className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {tr("order.saveDraft")}
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
                  {tr("order.submit")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
