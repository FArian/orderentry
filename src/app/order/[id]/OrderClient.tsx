"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FhirCoding,
  SpecimenChoice,
  ValueSetExpansion,
  ValueSetSummary,
} from "@/lib/fhir";
import { fhirGet, fhirPost, FHIR_BASE, fetchActivityAndObservation, ObservationDefinition, ActivityDefinition } from "@/lib/fhir";

type TabKey = "Allergy" | "Routine lab" | "Microbiology";

const TABS: TabKey[] = ["Allergy", "Routine lab", "Microbiology"];

const SPECIMENS: SpecimenChoice[] = [
  {
    id: "serum",
    label: "Serum",
    code: { system: "http://snomed.info/sct", code: "119297000", display: "Serum specimen" },
  },
  {
    id: "citrate",
    label: "Citrate plasma",
    code: { system: "http://snomed.info/sct", code: "122575003", display: "Citrate plasma" },
  },
];

// Local static categories and items per main tab
const LOCAL_VS: Record<TabKey, { summary: ValueSetSummary; items: ValueSetExpansion[] }[]> = {
  "Allergy": [],
  "Routine lab": [
    { summary: { url: "local:routine:haematology", title: "Haematology" }, items: [] },
    { summary: { url: "local:routine:haemostasis", title: "Haemostasis" }, items: [] },
    { summary: { url: "local:routine:clinical-chemistry", title: "Clinical chemistry" }, items: [] },
    { summary: { url: "local:routine:drugs-toxicology", title: "Drugs/Toxicology" }, items: [] },
    { summary: { url: "local:routine:immunology", title: "Immunology" }, items: [] },
    { summary: { url: "local:routine:immunohaematology", title: "Immunohaematology" }, items: [] },
    { summary: { url: "local:routine:infectious-diseases", title: "Infectious diseases" }, items: [] },
    { summary: { url: "local:routine:punctate-csf", title: "Punctate/cerebrospinal fluid" }, items: [] },
    { summary: { url: "local:routine:urine", title: "Urine" }, items: [] },
    { summary: { url: "local:routine:further-analyses", title: "Further analyses" }, items: [] },
  ],
  "Microbiology": [
    { summary: { url: "local:micro:direct-material", title: "Direct material" }, items: [] },
    { summary: { url: "local:micro:smears", title: "Smears" }, items: [] },
    { summary: { url: "local:micro:punctate-tissue", title: "Punctate/ Tissue" }, items: [] },
    { summary: { url: "local:micro:blood-culture", title: "Blood culture" }, items: [] },
    { summary: { url: "local:micro:foreign-material", title: "Foreign material" }, items: [] },
  ],
};

// no remote expansion type needed; using local catalog

type BundleEntry = { fullUrl?: string; response?: { location?: string } };

export default function OrderClient({ id }: { id: string }) {
  const [selectedTab, setSelectedTab] = useState<TabKey>("Allergy");
  const [categories, setCategories] = useState<ValueSetSummary[]>([]);
  const [categoriesNotice, setCategoriesNotice] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ValueSetSummary | null>(null);
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
  const [selectedSpecimens, setSelectedSpecimens] = useState<SpecimenChoice[]>([]);
  // Cache resolved specimen labels (type display) by reference (e.g., "Specimen/2001")
  const [specimenLabelCache, setSpecimenLabelCache] = useState<Record<string, string>>({});
  // Track per-analysis material contributions for later subtraction
  const [analysisContribs, setAnalysisContribs] = useState<Record<string, Array<{ specimenRef: string; num?: number; unit?: string; label: string }>>>({});

  // removed results viewer section (requested)

  const [catQuery, setCatQuery] = useState("");
  const [testQuery, setTestQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // Cache for ActivityDefinition/ObservationDefinition by coding key
  const [infoOpen, setInfoOpen] = useState<Record<string, boolean>>({});
  const [infoCache, setInfoCache] = useState<Record<string, { ad?: ActivityDefinition; od?: ObservationDefinition }>>({});
  const [infoLoading, setInfoLoading] = useState<Record<string, boolean>>({});

  const catDebounce = useRef<number | undefined>(undefined);
  const testDebounce = useRef<number | undefined>(undefined);

  // Load or switch categories when tab changes
  useEffect(() => {
    let cancelled = false;
    setCategoriesNotice(null);
    setSelectedCategory(null);

    async function load() {
      if (selectedTab === "Allergy") {
        try {
          const json = await fhirGet(
            "/ValueSet/$expand?url=" +
              encodeURIComponent("http://hl7.org/fhir/ValueSet/allergy-intolerance-category")
          );
          const list: ValueSetSummary[] = (json?.expansion?.contains || []).map(
            (c: { code?: string; display?: string }) => ({
              url: `fhir:allergy-category:${c.code || "unknown"}`,
              name: c.code,
              title: c.display || c.code || "Unknown",
            })
          );
          if (!cancelled) {
            setCategories(list);
          }
          return;
        } catch (e) {
          if (!cancelled) setCategoriesNotice("Failed to load categories");
        }
      }

      const local = LOCAL_VS[selectedTab] || [];
      if (!cancelled) {
        if (local.length > 0) {
          setCategories(local.map((m) => m.summary));
        } else {
          setCategories([]);
          setCategoriesNotice("No categories available for this tab.");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedTab]);

  // Restore local draft
  useEffect(() => {
    const key = `order:${id}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.selectedTests) setSelectedTests(parsed.selectedTests);
        if (parsed?.selectedSpecimens) setSelectedSpecimens(parsed.selectedSpecimens);
      }
    } catch {}
  }, [id]);

  const filteredCategories = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    return categories.filter((c) => {
      // Local filter by tab is intentionally shallow; keep all for now
      const label = (c.title || c.name || c.url).toLowerCase();
      return !q || label.includes(q);
    });
  }, [categories, catQuery]);

  // Auto-expand first category once categories are loaded
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
    (t: MiddleItem) => selectedTests.some((x) => x.system === t.system && x.code === t.code),
    [selectedTests]
  );

  const [materialsFromAnalyses, setMaterialsFromAnalyses] = useState<Record<string, { label: string; value?: string }>>({});

  const fetchMaterialsForAnalysis = useCallback(async (t: MiddleItem) => {
    try {
      const token = t.system && t.code ? `${t.system}|${t.code}` : t.code;
      const qs = new URLSearchParams();
      if (token) qs.set("code", token);
      qs.set("category", "laboratory");
      qs.set("subject", `Patient/${id}`);
      // Include linked Specimen to avoid extra round trips and trim Observation fields
      qs.set("_include", "Observation:specimen");
      qs.set("_elements", "id,code,specimen,valueQuantity");
      const bundle = await fhirGet(`/Observation?${qs.toString()}`);
      const entries: any[] = bundle?.entry || [];
      const specimenDisplays: Record<string, string> = {};
      for (const e of entries) {
        const r = e?.resource;
        if (r?.resourceType === "Specimen") {
          const ref = r.id ? `Specimen/${r.id}` : undefined;
          const disp = r?.type?.coding?.[0]?.display || r?.type?.text || ref || "Specimen";
          if (ref) specimenDisplays[ref] = disp;
        }
      }
      if (Object.keys(specimenDisplays).length) {
        setSpecimenLabelCache((prev) => ({ ...prev, ...specimenDisplays }));
      }
      const out: Array<{ specimenRef: string; num?: number; unit?: string; label: string }> = [];
      for (const e of entries) {
        const r = e?.resource;
        if (!r || r.resourceType !== "Observation") continue;
        const specimenRef: string | undefined = r.specimen?.reference;
        const valueQ = r.valueQuantity;
        let num: number | undefined;
        let unit: string | undefined;
        if (valueQ && (valueQ.value !== undefined && valueQ.value !== null)) {
          num = Number(valueQ.value);
          unit = valueQ.unit || valueQ.code || undefined;
        }
        if (specimenRef) {
          const label = specimenDisplays[specimenRef] || specimenLabelCache[specimenRef] || specimenRef;
          out.push({ specimenRef, num, unit, label });
        }
      }
      return out;
    } catch {
      return [];
    }
  }, [id, specimenLabelCache]);

  const toggleTest = useCallback((t: MiddleItem) => {
    const existsNow = selectedTests.some((x) => x.system === t.system && x.code === t.code);
    setSelectedTests((prev) => {
      const exists = prev.some((x) => x.system === t.system && x.code === t.code);
      return exists
        ? prev.filter((x) => !(x.system === t.system && x.code === t.code))
        : [...prev, t];
    });

    if (!existsNow) {
      // Log the full selected analysis object for debugging/inspection
      // Includes system, code, display, and any attached specimen/value
      console.log("Selected analysis:", t);
      // Load materials via Observation by analysis code (value + unit, specimen ref)
      fetchMaterialsForAnalysis(t).then((items) => {
        if (!items || items.length === 0) return;
        const key = `${t.system}|${t.code}`;
        setAnalysisContribs((prev) => ({ ...prev, [key]: items }));
        setMaterialsFromAnalyses((prev) => {
          const next = { ...prev } as Record<string, { label: string; value?: string }>;
          for (const it of items) {
            const aggKey = it.specimenRef;
            const current = next[aggKey];
            if (it.num !== undefined) {
              const curNum = current?.value ? Number(current.value.split(' ')[0]) : 0;
              const curUnit = current?.value ? current.value.split(' ').slice(1).join(' ') : undefined;
              const unit = it.unit || curUnit;
              const sum = (curNum || 0) + (Number(it.num) || 0);
              next[aggKey] = { label: it.label, value: `${sum}${unit ? ` ${unit}` : ''}` };
            } else {
              next[aggKey] = { label: it.label, value: current?.value };
            }
          }
          return next;
        });
      });
    }

    // If removing, clear materials derived from this analysis code
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
            const curNum = current.value ? Number(current.value.split(' ')[0]) : 0;
            const curUnit = current.value ? current.value.split(' ').slice(1).join(' ') : undefined;
            const unit = it.unit || curUnit;
            const remainder = Math.max(0, (curNum || 0) - (Number(it.num) || 0));
            if (remainder > 0) next[aggKey] = { label: current.label, value: `${remainder}${unit ? ` ${unit}` : ''}` };
            else delete next[aggKey];
          } else {
            if (!current.value) delete next[aggKey];
          }
        }
        return next;
      });
      setAnalysisContribs((prev) => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
    }
  }, [selectedTests, fetchMaterialsForAnalysis, analysisContribs]);

  const toggleInfo = useCallback(async (t: ValueSetExpansion) => {
    const key = `${t.system}|${t.code}`;
    setInfoOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    if (infoCache[key] || infoLoading[key]) return;
    try {
      setInfoLoading((p) => ({ ...p, [key]: true }));
      const { activity, observation } = await fetchActivityAndObservation(t.system, t.code);
      setInfoCache((p) => ({ ...p, [key]: { ad: activity, od: observation } }));
    } catch {
      // swallow errors; UI remains minimal
    } finally {
      setInfoLoading((p) => ({ ...p, [key]: false }));
    }
  }, [infoCache, infoLoading]);

  const toggleSpecimen = useCallback((s: SpecimenChoice) => {
    setSelectedSpecimens((prev) => {
      const exists = prev.some((x) => x.id === s.id);
      if (exists) return prev.filter((x) => x.id !== s.id);
      return [...prev, s];
    });
  }, []);

  // Note: removed manual material loader; materials now derive from selected analyses only

  const canSubmit = selectedTests.length > 0 && selectedSpecimens.length > 0 && !submitting;

  // Expand a ValueSet when selected
  const expandCategory = useCallback(
    async (vs: ValueSetSummary) => {
      setSelectedCategory(vs);
      setAvailableTests([]);
      setTestQuery("");
      setTestsLoading(true);
      // Use local items when present for the current tab
      const local = (LOCAL_VS[selectedTab] || []).find(
        (m) => m.summary.url === vs.url
      );
      if (local) {
        setAvailableTests(local.items);
        setTestsLoading(false);
        return;
      }
      // For Allergy, fetch AllergyIntolerance list filtered by category and optional codes
      if (selectedTab === "Allergy") {
        try {
          const categoryCode = vs.name || vs.url.split(":").pop() || ""; // e.g., food | medication | environment | biologic
          // Placeholder mapping for additional code filters per category.
          // Replace values as you provide specific code lists.
          const codeFilters: Record<string, string> = {
            environment: "256259004,418689008", // example provided
          };
          const qs = new URLSearchParams();
          if (categoryCode) qs.set("category", categoryCode);
          const codes = codeFilters[categoryCode];
          if (codes) qs.set("code", codes);
          const path = `/AllergyIntolerance?${qs.toString()}`;
          const json = await fhirGet(path);
          const entries: any[] = json?.entry || [];
          const list: MiddleItem[] = [];
          const seen = new Set<string>();
          for (const e of entries) {
            const r = e?.resource;
            const coding = r?.code?.coding?.[0];
            const sys = coding?.system || "";
            const code = coding?.code || "";
            const display = coding?.display || r?.code?.text || "Allergen";
            if (!sys || !code) continue;
            const key = `${sys}|${code}`;
            if (seen.has(key)) continue;
            seen.add(key);
            // Extract useful AllergyIntolerance details for inline display
            const categories: string[] = Array.isArray(r?.category) ? r.category : [];
            const criticality: string | undefined = r?.criticality;
            const reactions: string[] = Array.isArray(r?.reaction)
              ? r.reaction
                  .flatMap((rx: any) =>
                    Array.isArray(rx?.manifestation)
                      ? rx.manifestation.map((m: any) =>
                          m?.coding?.[0]?.display || m?.text || m?.coding?.[0]?.code
                        )
                      : []
                  )
                  .filter(Boolean)
              : [];
            const severity: string | undefined = r?.reaction?.[0]?.severity;
            const notes: string[] = Array.isArray(r?.note) ? r.note.map((n: any) => n?.text).filter(Boolean) : [];
            list.push({
              system: sys,
              code,
              display,
              resourceId: r?.id,
              categories,
              criticality,
              reactions,
              severity,
              notes,
            });
          }
          setAvailableTests(list);
          setTestsLoading(false);
          return;
        } catch {
          // swallow errors; keep empty
          setTestsLoading(false);
        }
      }
      // Default: keep empty
      setAvailableTests([]);
      setTestsLoading(false);
    },
    [selectedTab]
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

  // Build and submit transaction Bundle
  const submitOrder = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitMsg(null);
    setSubmitErr(null);
    try {
      const patFullUrl = "urn:uuid:pat-1";
      const specimenFullUrls = selectedSpecimens.map((_, i) => `urn:uuid:spec-${i + 1}`);
      const srFullUrls = selectedTests.map((_, i) => `urn:uuid:sr-${i + 1}`);

      const patientResource = {
        resourceType: "Patient",
        identifier: [{ system: "http://example.org/mrn", value: id }],
        name: [{ family: "Muster", given: ["Max"] }],
        gender: "male",
        birthDate: "1990-04-18",
      };

      const specimenEntries = selectedSpecimens.map((s, i) => ({
        fullUrl: specimenFullUrls[i],
        resource: {
          resourceType: "Specimen",
          status: "available",
          type: { coding: [s.code] },
          subject: { reference: patFullUrl },
        },
        request: { method: "POST", url: "Specimen" },
      }));

      const serviceRequestEntries = selectedTests.map((t, i) => ({
        fullUrl: srFullUrls[i],
        resource: {
          resourceType: "ServiceRequest",
          status: "active",
          intent: "order",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/service-category",
                  code: "laboratory",
                },
              ],
            },
          ],
          code: { coding: [t as FhirCoding] },
          subject: { reference: patFullUrl },
          specimen: specimenFullUrls.map((ref) => ({ reference: ref })),
        },
        request: { method: "POST", url: "ServiceRequest" },
      }));

      const bundle = {
        resourceType: "Bundle",
        type: "transaction",
        entry: [
          {
            fullUrl: patFullUrl,
            resource: patientResource,
            request: {
              method: "POST",
              url: "Patient",
              ifNoneExist: `identifier=http://example.org/mrn|${encodeURIComponent(id)}`,
            },
          },
          ...specimenEntries,
          ...serviceRequestEntries,
          {
            resource: {
              resourceType: "RequestGroup",
              status: "active",
              intent: "order",
              subject: { reference: patFullUrl },
              action: srFullUrls.map((ref) => ({ resource: { reference: ref } })),
            },
            request: { method: "POST", url: "RequestGroup" },
          },
        ],
      } as const;

      const resp = await fhirPost("/", bundle);
      let ids: string[] = [];
      if (resp?.entry && Array.isArray(resp.entry)) {
        ids = (resp.entry as BundleEntry[])
          .map((e) => e.response?.location)
          .filter(Boolean) as string[];
      }
      setSubmitMsg(`Auftrag gesendet. IDs: ${ids.join(", ") || "ok"}`);
      setSubmitErr(null);
      setSelectedTests([]);
      setSelectedSpecimens([]);
      try {
        localStorage.removeItem(`order:${id}`);
      } catch {}
    } catch (e: any) {
      setSubmitErr(e?.message || String(e));
      setSubmitMsg(null);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, id, selectedSpecimens, selectedTests]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Tabs */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-6">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTab(t)}
                className={`py-3 text-sm ${
                  t === selectedTab ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {t}
              </button>
            ))}
            <div className="ml-auto text-xs text-gray-400">FHIR: {FHIR_BASE.replace(/^https?:\/\//, "")}</div>
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
                catDebounce.current = window.setTimeout(() => setCatQuery(v), 250);
              }}
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          {categoriesNotice && (
            <div className="px-2 py-1 text-xs text-amber-700 bg-amber-50 border-b">{categoriesNotice}</div>
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
                testDebounce.current = window.setTimeout(() => setTestQuery(v), 250);
              }}
              className="w-full rounded border px-2 py-1 text-sm"
            />
            <div className="text-xs text-gray-500">
              {testsLoading ? "Lädt…" : `${availableTests.length} Tests`}
            </div>
          </div>
          <div className="flex-1 overflow-y-scroll overflow-x-hidden">
            {testsLoading && (
              <div className="p-3 text-sm text-gray-500">Analysen werden geladen…</div>
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
                    <span className="flex-1 truncate">{t.display || t.code}</span>
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
                      {infoLoading[key] && <div className="text-gray-500">Lade Details…</div>}
                      {!infoLoading[key] && (
                        <div className="rounded bg-gray-50 border p-2">
                          {details?.ad && (
                            <div className="mb-1">
                              <span className="font-medium">ActivityDefinition:</span>
                              <span className="ml-1">{details.ad.title || details.ad.name || details.ad.id}</span>
                            </div>
                          )}
                          {details?.od ? (
                            <div className="space-y-1">
                              <div><span className="font-medium">Observation:</span> {details.od.preferredReportName || details.od.code?.coding?.[0]?.display || details.od.code?.text || details.od.id}</div>
                              {details.od.quantitativeDetails?.unit && (
                                <div>
                                  <span className="font-medium">Einheit:</span>
                                  <span className="ml-1">{details.od.quantitativeDetails.unit.text || details.od.quantitativeDetails.unit.coding?.[0]?.display || details.od.quantitativeDetails.unit.coding?.[0]?.code}</span>
                                </div>
                              )}
                              {details.od.permittedDataType && details.od.permittedDataType.length > 0 && (
                                <div>
                                  <span className="font-medium">Datentyp:</span>
                                  <span className="ml-1">{details.od.permittedDataType.join(", ")}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-500">Keine ObservationDefinition gefunden.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {!testsLoading && selectedCategory && filteredTests.length === 0 && (
              <div className="p-3 text-sm text-gray-500">Keine Tests für Filter</div>
            )}
            {!testsLoading && !selectedCategory && (
              <div className="p-3 text-sm text-gray-500">Bitte links eine Kategorie wählen</div>
            )}
          </div>
        </div>

        {/* Right: Selected + Specimens */}
        <div className="min-h-0 flex flex-col gap-4">
          <div className="rounded border bg-white">
            <div className="px-3 py-2 border-b font-medium">Ausgewählte Analysen</div>
            <div className="p-3 flex flex-wrap gap-2">
              {selectedTests.map((t) => (
                <button
                  key={`${t.system}|${t.code}`}
                  onClick={() => toggleTest(t)}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs hover:bg-blue-200"
                  title="Entfernen"
                >
                  <span className="truncate max-w-[10rem]">{t.display || t.code}</span>
                  <span aria-hidden>×</span>
                </button>
              ))}
              {selectedTests.length === 0 && (
                <div className="text-sm text-gray-500">Noch nichts ausgewählt</div>
              )}
            </div>
          </div>

          <div className="rounded border bg-white">
            <div className="px-3 py-2 border-b font-medium">Ausgewähltes Material</div>
            <div className="p-3 flex flex-col gap-2">
              {Object.keys(materialsFromAnalyses).length === 0 && (
                <div className="text-xs text-gray-500">Noch kein Material (wird aus ausgewählten Analysen abgeleitet)</div>
              )}
              {Object.entries(materialsFromAnalyses).map(([specRef, m]) => (
                <div key={specRef} className="rounded border bg-indigo-50 px-2 py-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate">{m.label}</div>
                    {m.value && <div className="text-xs text-indigo-700 whitespace-nowrap">{m.value}</div>}
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
          {submitMsg && <div className="text-sm text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">{submitMsg}</div>}
          {submitErr && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">{submitErr}</div>}
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
                canSubmit ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
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
