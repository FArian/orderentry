"use client";

/**
 * useOrderCatalog — manages all FHIR ActivityDefinition catalog state:
 * top-level tabs, subcategories, available tests, selected tests/specimens,
 * material volumes, and the per-test info panel (AD/OD/SD).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ValueSetExpansion,
  ValueSetSummary,
  ActivityDefinitionSearchBundle,
  SpecimenChoice,
  SpecimenDefinitionSearchBundle,
} from "@/lib/fhir";
import {
  fhirGet,
  FHIR_EXT,
  fetchActivityAndObservation,
  ActivityDefinition,
  ObservationDefinition,
  SpecimenDefinition,
} from "@/lib/fhir";

// ── Type definitions ──────────────────────────────────────────────────────────

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export type MiddleItem = ValueSetExpansion & {
  /** Top-level department tab from ActivityDefinition.topic */
  topic?: string;
  /** Subcategory from ActivityDefinition.description */
  category?: string;
  specimenRef?: string;
  quantityValue?: number | string;
  quantityUnit?: string;
  resourceId?: string;
  categories?: string[];
  criticality?: string;
  reactions?: string[];
  severity?: string;
  notes?: string[];
};

export type InfoCacheEntry = {
  ad?: ActivityDefinition;
  od?: ObservationDefinition;
  sd?: SpecimenDefinition;
  minVol?: { value?: number; unit?: string; code?: string };
};

type VolumeItem = { specimenRef: string; num?: number; unit?: string; label: string };

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @param labOrgId  FHIR Organization ID of the lab (e.g. "zlz").
 *                  When set, only ActivityDefinitions whose useContext contains
 *                  a reference to Organisation/{labOrgId} are shown.
 *                  Pass undefined to load all (useful for single-lab setups
 *                  where ADs have no useContext yet).
 */
export function useOrderCatalog(labOrgId?: string) {
  const [topTabs, setTopTabs] = useState<string[]>([]);
  const [selectedTopTab, setSelectedTopTab] = useState<string | null>(null);
  const [allAds, setAllAds] = useState<ActivityDefinition[]>([]);
  const [pageLoading, setPageLoading] = useState<boolean>(true);
  const [categories, setCategories] = useState<ValueSetSummary[]>([]);
  const [categoriesNotice, setCategoriesNotice] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ValueSetSummary | null>(null);
  const [availableTests, setAvailableTests] = useState<MiddleItem[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [selectedTests, setSelectedTests] = useState<MiddleItem[]>([]);
  const [selectedSpecimens, setSelectedSpecimens] = useState<SpecimenChoice[]>([]);
  const [analysisContribs, setAnalysisContribs] = useState<
    Record<string, VolumeItem[]>
  >({});
  const [catQuery, setCatQuery] = useState("");
  const [testQuery, setTestQuery] = useState("");
  const [materialsFromAnalyses, setMaterialsFromAnalyses] = useState<
    Record<string, { label: string; value?: string }>
  >({});
  const [needsMaterialRecompute, setNeedsMaterialRecompute] = useState(false);
  const [infoOpen, setInfoOpen] = useState<Record<string, boolean>>({});
  const [infoCache, setInfoCache] = useState<Record<string, InfoCacheEntry>>({});
  const [infoLoading, setInfoLoading] = useState<Record<string, boolean>>({});

  const catDebounce = useRef<number | undefined>(undefined);
  const testDebounce = useRef<number | undefined>(undefined);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getTopicDisplay = useCallback((ad: ActivityDefinition): string | undefined => {
    const t = ad.topic;
    if (Array.isArray(t)) return t[0]?.coding?.[0]?.display;
    return t?.coding?.[0]?.display;
  }, []);

  const normalizeUnit = useCallback((u?: string): string | undefined => {
    if (!u) return u;
    if (u.toLowerCase() === "ul") return "µl";
    return u;
  }, []);

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Load all ActivityDefinitions once; derive top-level tabs from topic codings
  useEffect(() => {
    let cancelled = false;
    setCategoriesNotice(null);
    setSelectedCategory(null);

    async function load() {
      try {
        setPageLoading(true);
        const bundle = (await fhirGet("/ActivityDefinition?_count=5000")) as ActivityDefinitionSearchBundle;
        const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
        const allLoaded = entries
          .map((e) => e.resource)
          .filter(
            (r): r is ActivityDefinition =>
              isObject(r) &&
              (r as { resourceType?: unknown }).resourceType === "ActivityDefinition"
          );

        // Filter by lab organisation if labOrgId is provided
        const rawAds = labOrgId
          ? allLoaded.filter((ad) => {
              if (!Array.isArray(ad.useContext) || ad.useContext.length === 0) return true;
              return ad.useContext.some(
                (ctx) => ctx.valueReference?.reference === `Organization/${labOrgId}`
              );
            })
          : allLoaded;
        const seen = new Set<string>();
        const ads: ActivityDefinition[] = [];
        for (const a of rawAds) {
          const rid = (a as unknown as { id?: string }).id || "";
          const key =
            rid ||
            JSON.stringify(
              (a as unknown as { code?: { coding?: Array<{ system?: string; code?: string }> } })
                .code?.coding?.[0] || {}
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
              return sa !== sb ? sa - sb : a.i - b.i;
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
    return () => { cancelled = true; };
  }, [getTopicDisplay, labOrgId]);

  // Auto-select default top tab (prefer MIBI/Mikrobiologie)
  useEffect(() => {
    if (!selectedTopTab && topTabs.length > 0) {
      const preferred =
        topTabs.find((t) => t.toLowerCase() === "mibi") ||
        topTabs.find((t) => /mikro/i.test(t)) ||
        topTabs[0] ||
        null;
      setSelectedTopTab(preferred);
    }
  }, [topTabs, selectedTopTab]);

  // Build subcategory list whenever the top tab or AD list changes
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
      list.push({ url: `fhir:subcategory:${encodeURIComponent(desc)}`, title: desc });
    }
    setCategories(list);
    setCategoriesNotice(list.length === 0 ? "No categories available for this tab." : null);
    setSelectedCategory(null);
  }, [allAds, selectedTopTab, getTopicDisplay]);

  // Auto-select first category once the list is populated
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      expandCategory(categories[0]!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // Recompute materials after restoring tests from a saved SR
  useEffect(() => {
    if (!needsMaterialRecompute || allAds.length === 0 || selectedTests.length === 0) return;
    setNeedsMaterialRecompute(false);
    const newMaterials: Record<string, { label: string; value?: string }> = {};
    const newContribs: Record<string, VolumeItem[]> = {};
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
          newMaterials[aggKey] = {
            label: it.label,
            ...(current?.value !== undefined && { value: current.value }),
          };
        }
      }
    }
    setMaterialsFromAnalyses(newMaterials);
    setAnalysisContribs(newContribs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsMaterialRecompute, allAds, selectedTests]);

  // ── Computed ─────────────────────────────────────────────────────────────────

  const filteredCategories = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    return categories.filter((c) => {
      const label = (c.title || c.name || c.url).toLowerCase();
      return !q || label.includes(q);
    });
  }, [categories, catQuery]);

  const filteredTests = useMemo(() => {
    const q = testQuery.trim().toLowerCase();
    return availableTests.filter((t) => {
      const label = `${t.display || ""} ${t.code}`.toLowerCase();
      return !q || label.includes(q);
    });
  }, [availableTests, testQuery]);

  // ── Functions ─────────────────────────────────────────────────────────────────

  const isSelected = useCallback(
    (t: MiddleItem) => selectedTests.some((x) => x.system === t.system && x.code === t.code),
    [selectedTests]
  );

  // Extract volume/specimen items from the matching AD using current tab/subcategory
  const getMinimalVolumeItems = useCallback(
    (t: MiddleItem): VolumeItem[] => {
      const items: VolumeItem[] = [];
      const currentTab = selectedTopTab || "";
      const currentSub = (selectedCategory?.title || selectedCategory?.name || "").trim();
      for (const ad of allAds) {
        const tdisp = getTopicDisplay(ad);
        if (tdisp !== currentTab) continue;
        if ((ad.description || "").trim() !== currentSub) continue;
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
        if (value !== undefined) items.push({ specimenRef, num: value, label, ...(unit !== undefined && { unit }) });
        break;
      }
      return items;
    },
    [allAds, getTopicDisplay, selectedTopTab, selectedCategory, normalizeUnit]
  );

  // Variant that uses the test's own topic/category fields (used during draft restore)
  const getMinimalVolumeItemsByTest = useCallback(
    (t: MiddleItem): VolumeItem[] => {
      const items: VolumeItem[] = [];
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
        if (value !== undefined) items.push({ specimenRef, num: value, label, ...(unit !== undefined && { unit }) });
        break;
      }
      return items;
    },
    [allAds, getTopicDisplay, normalizeUnit]
  );

  const toggleTest = useCallback(
    (t: MiddleItem) => {
      const existsNow = selectedTests.some((x) => x.system === t.system && x.code === t.code);
      setSelectedTests((prev) => {
        const exists = prev.some((x) => x.system === t.system && x.code === t.code);
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
            const next = { ...prev } as Record<string, { label: string; value?: string }>;
            for (const it of items) {
              const aggKey = it.specimenRef;
              const current = next[aggKey];
              if (it.num !== undefined) {
                const curNum = current?.value ? Number(current.value.split(" ")[0]) : 0;
                const curUnit = current?.value ? current.value.split(" ").slice(1).join(" ") : undefined;
                const unit = normalizeUnit(it.unit || curUnit);
                const sum = (curNum || 0) + (Number(it.num) || 0);
                next[aggKey] = { label: it.label, value: `${sum}${unit ? ` ${unit}` : ""}` };
              } else {
                next[aggKey] = { label: it.label, ...(current?.value !== undefined && { value: current.value }) };
              }
            }
            return next;
          });
        }
      }

      if (existsNow) {
        const key = `${t.system}|${t.code}`;
        const contribs = analysisContribs[key] || [];
        setMaterialsFromAnalyses((prev) => {
          const next: Record<string, { label: string; value?: string }> = { ...prev };
          for (const it of contribs) {
            const aggKey = it.specimenRef;
            const current = next[aggKey];
            if (!current) continue;
            if (it.num !== undefined) {
              const curNum = current.value ? Number(current.value.split(" ")[0]) : 0;
              const curUnit = current.value ? current.value.split(" ").slice(1).join(" ") : undefined;
              const unit = it.unit || curUnit;
              const remainder = Math.max(0, (curNum || 0) - (Number(it.num) || 0));
              if (remainder > 0)
                next[aggKey] = { label: current.label, value: `${remainder}${unit ? ` ${unit}` : ""}` };
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
    async (t: MiddleItem) => {
      const key = `${t.system}|${t.code}`;
      setInfoOpen((prev) => ({ ...prev, [key]: !prev[key] }));
      if (infoCache[key] || infoLoading[key]) return;
      try {
        setInfoLoading((p) => ({ ...p, [key]: true }));
        const { activity, observation } = await fetchActivityAndObservation(t.system, t.code);
        let minVol: { value?: number; unit?: string; code?: string } | undefined;
        if (activity && Array.isArray(activity.extension)) {
          const volExt = activity.extension.find(
            (ex) => ex && (ex as { url?: string }).url === FHIR_EXT.minimalVolume
          );
          const vq = (volExt as unknown as { valueQuantity?: { value?: number; unit?: string; code?: string } })?.valueQuantity;
          if (vq) minVol = {
            ...(vq.value !== undefined && { value: vq.value }),
            ...(vq.unit  !== undefined && { unit:  vq.unit  }),
            ...(vq.code  !== undefined && { code:  vq.code  }),
          };
        }
        let sd: SpecimenDefinition | undefined;
        if (activity && Array.isArray(activity.extension)) {
          const specExt = activity.extension.find(
            (ex) => ex && (ex as { url?: string }).url === FHIR_EXT.specimenDefinition
          );
          const idVal = (specExt as unknown as { valueReference?: { identifier?: { value?: string } } })?.valueReference?.identifier?.value;
          if (idVal) {
            try {
              const bundle = (await fhirGet(
                `/SpecimenDefinition?identifier=${encodeURIComponent(idVal)}`
              )) as SpecimenDefinitionSearchBundle;
              const entry = Array.isArray(bundle.entry)
                ? bundle.entry.find(
                    (e) =>
                      e.resource &&
                      (e.resource as { resourceType?: string }).resourceType === "SpecimenDefinition"
                  )
                : undefined;
              if (entry?.resource) sd = entry.resource as SpecimenDefinition;
            } catch { /* ignore specimen fetch errors */ }
          }
        }
        setInfoCache((p) => ({
          ...p,
          [key]: {
            ...(activity    !== undefined && { ad: activity    }),
            ...(observation !== undefined && { od: observation }),
            ...(sd          !== undefined && { sd              }),
            ...(minVol      !== undefined && { minVol          }),
          },
        }));
      } catch { /* swallow; UI shows nothing */ } finally {
        setInfoLoading((p) => ({ ...p, [key]: false }));
      }
    },
    [infoCache, infoLoading]
  );

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
            ...(tdisp  && { topic:    tdisp  }),
            ...(subcat && { category: subcat }),
          });
        }
        setAvailableTests(list);
      } finally {
        setTestsLoading(false);
      }
    },
    [allAds, selectedTopTab, getTopicDisplay]
  );

  // ── Return ────────────────────────────────────────────────────────────────────

  return {
    // State
    topTabs, selectedTopTab, setSelectedTopTab,
    allAds, pageLoading,
    categories, categoriesNotice,
    selectedCategory,
    availableTests, testsLoading,
    selectedTests, setSelectedTests,
    selectedSpecimens, setSelectedSpecimens,
    analysisContribs, setAnalysisContribs,
    catQuery, setCatQuery,
    testQuery, setTestQuery,
    materialsFromAnalyses, setMaterialsFromAnalyses,
    needsMaterialRecompute, setNeedsMaterialRecompute,
    infoOpen, infoCache, infoLoading,
    // Refs
    catDebounce, testDebounce,
    // Computed
    filteredCategories, filteredTests,
    // Functions
    isSelected, toggleTest, toggleInfo, expandCategory,
  };
}

export type OrderCatalog = ReturnType<typeof useOrderCatalog>;
