"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FhirCoding,
  SpecimenChoice,
  ValueSetExpansion,
  ValueSetSummary,
} from "@/lib/fhir";
import { fhirGet, fhirPost, FHIR_BASE, fetchActivityAndObservation, ObservationDefinition, ActivityDefinition } from "@/lib/fhir";

type TabKey = "Allergologie" | "Routinelabor" | "Mikrobiologie" | "Z-Point";

const TABS: TabKey[] = ["Allergologie", "Routinelabor", "Mikrobiologie", "Z-Point"];

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

// Local mock ValueSet expansions if remote listing returns none
const MOCK_VS: { summary: ValueSetSummary; items: ValueSetExpansion[] }[] = [
  {
    summary: { url: "http://example.org/fhir/ValueSet/inhalationsallergene-tiere", title: "Inhalationsallergene – Tiere" },
    items: [
      { system: "http://loinc.org", code: "74845-2", display: "Anti-factor Xa activity" },
      { system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c/Hemoglobin.total in Blood" },
      { system: "http://loinc.org", code: "718-7", display: "Hemoglobin [Mass/volume] in Blood" },
      { system: "http://loinc.org", code: "718-7", display: "Duplicate Hemoglobin (for UI)" },
      { system: "http://loinc.org", code: "15074-8", display: "Glucose [Moles/volume] in Blood" },
      { system: "http://loinc.org", code: "6299-2", display: "Urea nitrogen [Mass/volume] in Serum or Plasma" },
    ],
  },
  {
    summary: { url: "http://example.org/fhir/ValueSet/nahrungsmittelallergen-screen", title: "Nahrungsmittelallergen – Screen" },
    items: [
      { system: "http://loinc.org", code: "4544-3", display: "ALT [Enzymatic activity/volume] in Serum or Plasma" },
      { system: "http://loinc.org", code: "13457-7", display: "Cholesterol in LDL [Mass/volume] in Serum or Plasma" },
      { system: "http://loinc.org", code: "2093-3", display: "Cholesterol [Mass/volume] in Serum or Plasma" },
      { system: "http://loinc.org", code: "14647-2", display: "C reactive protein [Mass/volume] in Serum or Plasma" },
      { system: "http://loinc.org", code: "33244-9", display: "Fibrin D-dimer FEU [Mass/volume] in Platelet poor plasma" },
    ],
  },
];

type ExpandResponse = {
  resourceType: "ValueSet";
  expansion?: { contains?: Array<{ system?: string; code?: string; display?: string }> };
};

type BundleEntry = { fullUrl?: string; response?: { location?: string } };

export default function AuftragClient({ id }: { id: string }) {
  const [selectedTab, setSelectedTab] = useState<TabKey>("Allergologie");
  const [categories, setCategories] = useState<ValueSetSummary[]>([]);
  const [categoriesNotice, setCategoriesNotice] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ValueSetSummary | null>(null);
  const [availableTests, setAvailableTests] = useState<ValueSetExpansion[]>([]);
  const [selectedTests, setSelectedTests] = useState<ValueSetExpansion[]>([]);
  const [selectedSpecimens, setSelectedSpecimens] = useState<SpecimenChoice[]>([]);

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

  // Load categories once
  useEffect(() => {
    let active = true;
    setCategoriesNotice(null);
    // Fixed discovery pattern as per spec
    fhirGet(`/ValueSet?_summary=true&name:contains=Allergie`)
      .then((json) => {
        if (!active) return;
        const arr: ValueSetSummary[] = (json.entry || [])
          .map((e: any) => e.resource)
          .filter((r: any) => r && r.resourceType === "ValueSet" && r.url)
          .map((r: any) => ({ url: r.url as string, name: r.name, title: r.title }));
        if (!arr.length) {
          setCategoriesNotice(
            `Keine ValueSets gefunden. Zeige lokale Beispiele (Testmodus).`
          );
          setCategories(MOCK_VS.map((m) => m.summary));
        } else {
          setCategories(arr);
        }
      })
      .catch(() => {
        if (!active) return;
        setCategoriesNotice(
          `FHIR-Auflistung fehlgeschlagen. Zeige lokale Beispiele (Testmodus).`
        );
        setCategories(MOCK_VS.map((m) => m.summary));
      });
    return () => {
      active = false;
    };
  }, []);

  // Restore local draft
  useEffect(() => {
    const key = `auftrag:${id}`;
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
    (t: ValueSetExpansion) => selectedTests.some((x) => x.system === t.system && x.code === t.code),
    [selectedTests]
  );

  const toggleTest = useCallback(
    (t: ValueSetExpansion) => {
      setSelectedTests((prev) => {
        const exists = prev.some((x) => x.system === t.system && x.code === t.code);
        if (exists) return prev.filter((x) => !(x.system === t.system && x.code === t.code));
        return [...prev, t];
      });
    },
    []
  );

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

  const canSubmit = selectedTests.length > 0 && selectedSpecimens.length > 0 && !submitting;

  // Expand a ValueSet when selected
  const expandCategory = useCallback(
    async (vs: ValueSetSummary) => {
      setSelectedCategory(vs);
      setAvailableTests([]);
      setTestQuery("");
      // If local mock matches
      const mock = MOCK_VS.find((m) => m.summary.url === vs.url);
      if (mock) {
        setAvailableTests(mock.items);
        return;
      }
      try {
        const params = {
          resourceType: "Parameters",
          parameter: [
            { name: "url", valueUri: vs.url },
            { name: "count", valueInteger: 500 },
          ],
        };
        const json = (await fhirPost("/ValueSet/$expand", params)) as ExpandResponse;
        const list =
          json?.expansion?.contains?.
            map((c) => ({ system: c.system || "", code: c.code || "", display: c.display }))
            .filter((x) => x.system && x.code) || [];
        setAvailableTests(list);
      } catch (e) {
        setAvailableTests([]);
      }
    },
    []
  );

  // Save local draft
  const saveDraft = useCallback(() => {
    const key = `auftrag:${id}`;
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
        localStorage.removeItem(`auftrag:${id}`);
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
      <div className="mx-auto max-w-7xl flex-1 grid grid-cols-12 gap-4 p-4">
        {/* Left: Categories */}
        <div className="col-span-3 min-h-0 flex flex-col rounded border bg-white">
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
          <div className="flex-1 overflow-auto">
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
                  {label}
                </button>
              );
            })}
            {filteredCategories.length === 0 && (
              <div className="p-3 text-sm text-gray-500">Keine Kategorien</div>
            )}
          </div>
        </div>

        {/* Middle: Available tests */}
        <div className="col-span-6 min-h-0 flex flex-col rounded border bg-white">
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
              {availableTests.length} Tests
            </div>
          </div>
          <div className="flex-1 overflow-auto">
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
            {selectedCategory && filteredTests.length === 0 && (
              <div className="p-3 text-sm text-gray-500">Keine Tests für Filter</div>
            )}
            {!selectedCategory && (
              <div className="p-3 text-sm text-gray-500">Bitte links eine Kategorie wählen</div>
            )}
          </div>
        </div>

        {/* Right: Selected + Specimens */}
        <div className="col-span-3 min-h-0 flex flex-col gap-4">
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
              {SPECIMENS.map((s) => (
                <label key={s.id} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!selectedSpecimens.find((x) => x.id === s.id)}
                    onChange={() => toggleSpecimen(s)}
                    className="accent-blue-600"
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </div>
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
