"use client";

/**
 * OrderFormView — pure presentational component for the order entry screen.
 * Receives all state and callbacks via props; contains no business logic.
 */

import Link from "next/link";
import { formatDate } from "@/shared/utils/formatDate";
import type { OrderCatalog } from "@/presentation/hooks/useOrderCatalog";
import type { OrderForm } from "@/presentation/hooks/useOrderForm";
import type { OrderDocuments } from "@/presentation/hooks/useOrderDocuments";

// ── Props ─────────────────────────────────────────────────────────────────────

interface OrderFormViewProps {
  patientId: string;
  catalog: OrderCatalog;
  form: OrderForm;
  docs: OrderDocuments;
  tr: (key: string) => string;
  canSubmit: boolean;
  submitOrder: () => Promise<void>;
}

// ── Patient name helpers ───────────────────────────────────────────────────────

type FhirPatient = {
  name?: Array<{ text?: string; given?: string[]; family?: string }>;
  birthDate?: string;
  gender?: string;
};

function getPatientName(pd: FhirPatient | null): string {
  if (!pd) return "";
  const n = pd.name?.[0];
  if (!n) return "";
  if (n.text) return n.text;
  return [n.given?.[0], n.family].filter(Boolean).join(" ");
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OrderFormView({
  patientId,
  catalog,
  form,
  docs,
  tr,
  canSubmit,
  submitOrder,
}: OrderFormViewProps) {
  const {
    topTabs, selectedTopTab, setSelectedTopTab,
    pageLoading, categoriesNotice,
    selectedCategory, filteredCategories,
    filteredTests, testsLoading,
    selectedTests, materialsFromAnalyses,
    catQuery, setCatQuery, testQuery,
    infoOpen, infoCache, infoLoading,
    catDebounce, testDebounce,
    isSelected, toggleTest, toggleInfo, expandCategory,
  } = catalog;

  const {
    patientLoading, srLoading, patientData,
    priority, setPriority,
    collectionDate, setCollectionDate,
    requester, setRequester,
    setRequesterId,
    requesterQuery, setRequesterQuery,
    practitioners, practitionersOpen, setPractitionersOpen,
    encounterClass, setEncounterClass,
    clinicalNote, setClinicalNote,
    isReadOnly, submitting,
    submitMsg, submitErr,
    searchPractitioners,
    saveDraft,
    getPatientIdentifiers,
    generateOrderNumber,
  } = form;

  const {
    previewModal, setPreviewModal,
    previewContent, previewCopied,
    openPreview, copyPreview,
    printBegleitschein, printLabel,
  } = docs;

  // ── Derived patient display data ───────────────────────────────────────────

  const pd = patientData as FhirPatient | null;
  const patientName = getPatientName(pd);
  const initials = patientName ? getInitials(patientName) : "?";
  const dob = formatDate(pd?.birthDate);
  const gender = pd?.gender ?? "";
  const { ahv } = getPatientIdentifiers();


  // ── Loading overlay ────────────────────────────────────────────────────────

  if (pageLoading || patientLoading || srLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zt-bg-page">
        <div
          className="h-9 w-9 animate-spin rounded-full border-4 border-zt-border border-t-zt-primary"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100%" }}>

      {/* ── Subbar: breadcrumb + FHIR badge ─────────────────────────────────── */}
      <div className="h-11 shrink-0 bg-zt-bg-card border-b border-zt-border flex items-center justify-between px-6">
        <nav className="flex items-center gap-1.5 text-xs text-zt-text-tertiary" aria-label="Breadcrumb">
          <Link href="/" className="text-zt-primary hover:underline">{tr("nav.home")}</Link>
          <span>/</span>
          <Link href="/patient" className="text-zt-primary hover:underline">{tr("nav.patients")}</Link>
          <span>/</span>
          <Link href={`/patient/${patientId}`} className="text-zt-primary hover:underline">
            {patientName || patientId}
          </Link>
          <span>/</span>
          <span className="text-zt-text-primary">{tr("order.newOrder")}</span>
        </nav>
        <span className="text-[11px] text-zt-success bg-zt-success-light px-2.5 py-0.5 rounded-full border border-zt-success-border">
          FHIR verbunden
        </span>
      </div>

      {/* ── Patient context bar ────────────────────────────────────────────── */}
      <div className="shrink-0 bg-zt-primary-light border-b border-zt-primary-border px-6 py-1.5 flex items-center gap-4">
        <div
          className="w-[30px] h-[30px] rounded-full bg-zt-primary flex items-center justify-center text-[11px] font-medium text-zt-text-on-primary shrink-0"
          aria-hidden="true"
        >
          {initials}
        </div>
        <span className="text-sm font-medium text-zt-primary">{patientName || patientId}</span>
        {dob && (
          <>
            <span className="text-zt-primary-border">·</span>
            <span className="text-xs text-zt-primary">{tr("order.dob")}: {dob}</span>
          </>
        )}
        {gender && (
          <>
            <span className="text-zt-primary-border">·</span>
            <span className="text-xs text-zt-primary capitalize">{gender}</span>
          </>
        )}
        {ahv && (
          <>
            <span className="text-zt-primary-border">·</span>
            <span className="text-xs text-zt-primary">AHV: {ahv}</span>
          </>
        )}
        {isReadOnly && (
          <>
            <span className="text-zt-primary-border">·</span>
            <span className="text-xs text-zt-danger font-medium">{tr("order.readOnly")}</span>
          </>
        )}
      </div>

      {/* ── Main 3-column workspace ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left column: categories — width adapts to content (min 180 px, max 300 px) */}
        <div className="min-w-[180px] max-w-[300px] flex-none flex flex-col border-r border-zt-border bg-zt-bg-card">

          {/* Category header */}
          <div className="px-3.5 pt-3 pb-2 border-b border-zt-border shrink-0">
            <div className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide mb-2">
              {tr("order.categories")}
            </div>
            <input
              type="text"
              placeholder={tr("order.searchCategories")}
              value={catQuery}
              onChange={(e) => {
                window.clearTimeout(catDebounce.current);
                const v = e.target.value;
                catDebounce.current = window.setTimeout(() => setCatQuery(v), 250);
              }}
              className="w-full rounded-[7px] border border-zt-border bg-zt-bg-page px-2.5 py-[6px] text-xs text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary"
            />
          </div>

          {/* Tab row — inside left column */}
          {topTabs.length > 0 && (
            <div className="flex flex-wrap border-b border-zt-border shrink-0">
              {topTabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTopTab(t)}
                  className={`text-xs px-3.5 py-[9px] whitespace-nowrap border-b-2 transition-colors ${
                    t === selectedTopTab
                      ? "border-zt-primary text-zt-primary font-medium"
                      : "border-transparent text-zt-text-secondary hover:text-zt-text-primary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Categories notice */}
          {categoriesNotice && (
            <div className="px-3 py-1 text-[11px] text-zt-warning-text bg-zt-warning-bg border-b border-zt-border">
              {categoriesNotice}
            </div>
          )}

          {/* Category list */}
          <div className="flex-1 overflow-y-auto py-1.5">
            {filteredCategories.map((c) => {
              const label = c.title || c.name || c.url;
              const active = selectedCategory?.url === c.url;
              return (
                <button
                  key={c.url}
                  onClick={() => expandCategory(c)}
                  title={c.url}
                  className={`w-full text-left px-3.5 py-2 text-[13px] border-l-2 flex items-center justify-between gap-2 transition-colors ${
                    active
                      ? "bg-zt-primary-light text-zt-primary border-l-zt-primary font-medium"
                      : "text-zt-text-secondary border-l-transparent hover:bg-zt-bg-page hover:text-zt-text-primary"
                  }`}
                >
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              );
            })}
            {filteredCategories.length === 0 && (
              <div className="px-3.5 py-3 text-xs text-zt-text-tertiary">{tr("order.noCategories")}</div>
            )}
          </div>
        </div>

        {/* Middle column: available analyses */}
        <div className="flex-1 flex flex-col bg-zt-bg-page overflow-hidden">

          {/* Analyses header */}
          <div className="bg-zt-bg-card border-b border-zt-border px-4 py-2.5 flex items-center gap-2.5 shrink-0">
            <div className="relative flex-1">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zt-text-tertiary pointer-events-none"
                width="13" height="13" viewBox="0 0 13 13" fill="none"
                stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
              >
                <circle cx="5.5" cy="5.5" r="4" />
                <path d="M9 9l3 3" />
              </svg>
              <input
                type="text"
                placeholder={tr("order.searchTests")}
                value={testQuery}
                onChange={(e) => {
                  window.clearTimeout(testDebounce.current);
                  const v = e.target.value;
                  testDebounce.current = window.setTimeout(
                    () => catalog.setTestQuery(v),
                    250
                  );
                }}
                className="w-full rounded-[7px] border border-zt-border bg-zt-bg-page pl-8 pr-3 py-[7px] text-[13px] text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary"
              />
            </div>
            {!testsLoading && (
              <span className="text-[11px] text-zt-primary bg-zt-primary-light px-2 py-0.5 rounded-full whitespace-nowrap">
                {catalog.availableTests.length} {tr("order.tests")}
              </span>
            )}
            {testsLoading && (
              <span className="text-[11px] text-zt-text-tertiary whitespace-nowrap">{tr("common.loading")}</span>
            )}
          </div>

          {/* Analyses body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1.5">
            {testsLoading && (
              <div className="flex-1 flex items-center justify-center text-sm text-zt-text-tertiary">
                {tr("common.loading")}
              </div>
            )}

            {!testsLoading && !selectedCategory && (
              <div className="flex-1 flex flex-col items-center justify-center text-sm text-zt-text-tertiary gap-2 py-10 text-center">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="opacity-30" aria-hidden="true">
                  <rect x="6" y="4" width="24" height="28" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 12h12M12 18h8M12 24h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {tr("order.selectCategory")}
              </div>
            )}

            {!testsLoading && selectedCategory && filteredTests.length === 0 && (
              <div className="py-10 text-center text-sm text-zt-text-tertiary">
                {tr("order.noTests")}
              </div>
            )}

            {filteredTests.map((t) => {
              const key = `${t.system}|${t.code}`;
              const details = infoCache[key];
              const open = infoOpen[key];
              const selected = isSelected(t);
              return (
                <div key={key} className="shrink-0">
                  {/* Analysis card */}
                  <div
                    onClick={() => toggleTest(t)}
                    role="checkbox"
                    aria-checked={selected}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleTest(t); } }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] border cursor-pointer transition-colors ${
                      selected
                        ? "border-zt-primary bg-zt-primary-light"
                        : "border-zt-border bg-zt-bg-card hover:border-zt-primary-border hover:bg-zt-bg-muted"
                    }`}
                  >
                    {/* Custom checkbox */}
                    <div
                      className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border-[1.5px] transition-colors ${
                        selected
                          ? "bg-zt-primary border-zt-primary"
                          : "bg-zt-bg-card border-zt-border"
                      }`}
                      aria-hidden="true"
                    >
                      {selected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-medium truncate ${selected ? "text-zt-primary" : "text-zt-text-primary"}`}>
                        {t.display || t.code}
                      </div>
                      {t.topic && (
                        <div className="text-[11px] text-zt-text-tertiary mt-0.5 truncate">{t.topic}{t.category ? ` · ${t.category}` : ""}</div>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] bg-zt-bg-page text-zt-text-secondary border border-zt-border px-1.5 py-0.5 rounded-lg font-medium">
                        #{t.code}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleInfo(t); }}
                        className="text-[10px] bg-zt-primary-light text-zt-primary px-1.5 py-0.5 rounded-lg font-medium hover:bg-zt-primary hover:text-zt-text-on-primary transition-colors"
                      >
                        Info
                      </button>
                    </div>
                  </div>

                  {/* Info panel */}
                  {open && (
                    <div className="mx-1 mb-1 px-3 py-2.5 text-xs text-zt-text-secondary bg-zt-bg-page border border-zt-border rounded-b-[9px] -mt-1">
                      {infoLoading[key] && (
                        <div className="text-zt-text-tertiary">{tr("common.loading")}</div>
                      )}
                      {!infoLoading[key] && (
                        <>
                          {details?.ad && (
                            <div className="mb-1">
                              <span className="font-medium text-zt-text-primary">ActivityDefinition:</span>
                              <span className="ml-1">
                                {details.ad.title || details.ad.name || (details.ad as unknown as { id?: string }).id}
                              </span>
                            </div>
                          )}
                          {details?.od ? (
                            <div className="space-y-1">
                              <div>
                                <span className="font-medium text-zt-text-primary">{tr("order.observation")}:</span>{" "}
                                {details.od.preferredReportName ||
                                  details.od.code?.coding?.[0]?.display ||
                                  details.od.code?.text ||
                                  (details.od as unknown as { id?: string }).id}
                              </div>
                              {details.od.quantitativeDetails?.unit && (
                                <div>
                                  <span className="font-medium text-zt-text-primary">{tr("order.unit")}:</span>
                                  <span className="ml-1">
                                    {details.od.quantitativeDetails.unit.text ||
                                      details.od.quantitativeDetails.unit.coding?.[0]?.display ||
                                      details.od.quantitativeDetails.unit.coding?.[0]?.code}
                                  </span>
                                </div>
                              )}
                              {details.od.permittedDataType && details.od.permittedDataType.length > 0 && (
                                <div>
                                  <span className="font-medium text-zt-text-primary">{tr("order.datatype")}:</span>
                                  <span className="ml-1">{details.od.permittedDataType.join(", ")}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-zt-text-tertiary">{tr("order.noObservation")}</div>
                          )}
                          {details?.sd && (
                            <div className="mt-1.5 space-y-1">
                              <div>
                                <span className="font-medium text-zt-text-primary">{tr("order.material")}:</span>{" "}
                                {details.sd.typeCollected?.text || details.sd.typeCollected?.coding?.[0]?.display}
                              </div>
                              {Array.isArray(details.sd.container) && details.sd.container[0]?.description && (
                                <div>
                                  <span className="font-medium text-zt-text-primary">{tr("order.container")}:</span>
                                  <span className="ml-1">{details.sd.container[0]?.description}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {details?.minVol && details.minVol.value !== undefined && (
                            <div className="mt-1">
                              <span className="font-medium text-zt-text-primary">{tr("order.minVolume")}:</span>
                              <span className="ml-1">
                                {details.minVol.value}
                                {details.minVol.unit ? ` ${details.minVol.unit}` : details.minVol.code ? ` ${details.minVol.code}` : ""}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: order details panel */}
        <div className="w-[280px] shrink-0 flex flex-col border-l border-zt-border bg-zt-bg-card overflow-y-auto">

          {/* Selected analyses */}
          <div className="px-4 py-3.5 border-b border-zt-border">
            <div className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide mb-2.5">
              {tr("order.selectedTests")}{selectedTests.length > 0 ? ` (${selectedTests.length})` : ""}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedTests.map((t) => (
                <button
                  key={`${t.system}|${t.code}`}
                  onClick={() => toggleTest(t)}
                  title={tr("order.removeTest")}
                  className="inline-flex items-center gap-1 rounded-full bg-zt-primary-light text-zt-primary border border-zt-primary-border px-2 py-0.5 text-[11px] hover:bg-zt-primary hover:text-zt-text-on-primary hover:border-zt-primary transition-colors"
                >
                  <span className="truncate max-w-[9rem]">{t.display || t.code}</span>
                  <span aria-hidden="true" className="text-[13px] leading-none">×</span>
                </button>
              ))}
              {selectedTests.length === 0 && (
                <div className="text-xs text-zt-text-tertiary">{tr("order.noTests")}</div>
              )}
            </div>
          </div>

          {/* Required specimens / materials */}
          <div className="px-4 py-3.5 border-b border-zt-border">
            <div className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide mb-2.5">
              {tr("order.selectedMaterial")}
            </div>
            {Object.keys(materialsFromAnalyses).length === 0 && (
              <div className="text-xs text-zt-text-tertiary">{tr("order.noMaterial")}</div>
            )}
            {Object.entries(materialsFromAnalyses).map(([specRef, m]) => (
              <div key={specRef} className="flex items-center justify-between rounded-[7px] bg-zt-bg-page px-2.5 py-1.5 mb-1.5 text-sm">
                <span className="font-medium text-zt-text-primary truncate">{m.label}</span>
                {m.value && (
                  <span className="text-[11px] text-zt-primary bg-zt-primary-light px-1.5 py-0.5 rounded-lg ml-2 whitespace-nowrap">{m.value}</span>
                )}
              </div>
            ))}
          </div>

          {/* Order details form */}
          <div className="px-4 py-3.5 border-b border-zt-border">
            <div className="text-[11px] font-medium text-zt-text-tertiary uppercase tracking-wide mb-3">
              {tr("order.details")}
            </div>

            {/* Priority */}
            <div className="text-[11px] text-zt-text-secondary mb-1">{tr("order.priority")}</div>
            <div className="flex gap-1.5 mb-3">
              <button
                onClick={() => setPriority("routine")}
                className={`flex-1 py-[7px] rounded-[7px] border text-xs font-medium transition-colors ${
                  priority === "routine"
                    ? "bg-zt-primary text-zt-text-on-primary border-zt-primary"
                    : "bg-zt-bg-page text-zt-text-secondary border-zt-border hover:bg-zt-bg-muted"
                }`}
              >
                {tr("order.priority_routine")}
              </button>
              <button
                onClick={() => setPriority("urgent")}
                className={`flex-1 py-[7px] rounded-[7px] border text-xs font-medium transition-colors ${
                  priority === "urgent"
                    ? "bg-zt-danger text-zt-text-on-danger border-zt-danger"
                    : "bg-zt-bg-page text-zt-text-secondary border-zt-border hover:bg-zt-bg-muted"
                }`}
              >
                {tr("order.priority_urgent")}
              </button>
            </div>

            {/* Collection date */}
            <div className="text-[11px] text-zt-text-secondary mb-1">{tr("order.collectionDate")}</div>
            <input
              type="datetime-local"
              value={collectionDate}
              onChange={(e) => setCollectionDate(e.target.value)}
              className="w-full rounded-[7px] border border-zt-border bg-zt-bg-page px-2.5 py-[7px] text-xs text-zt-text-primary outline-none focus:border-zt-primary mb-3"
            />

            {/* Requester autocomplete */}
            <div className="text-[11px] text-zt-text-secondary mb-1">{tr("order.requester")}</div>
            <div className="relative mb-3">
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
                className="w-full rounded-[7px] border border-zt-border bg-zt-bg-page px-2.5 py-[7px] text-xs text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary"
              />
              {requester && (
                <div className="mt-1.5 flex items-center gap-1.5 bg-zt-primary-light text-zt-primary rounded-full px-2.5 py-1 text-xs">
                  <span className="truncate flex-1">{requester}</span>
                  <button
                    type="button"
                    onClick={() => { setRequester(""); setRequesterId(""); setRequesterQuery(""); }}
                    className="text-[14px] leading-none hover:opacity-70"
                    aria-label={tr("order.clearRequester")}
                  >
                    ×
                  </button>
                </div>
              )}
              {practitionersOpen && practitioners.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-zt-bg-card border border-zt-border rounded-[7px] shadow-[var(--zt-shadow-lg)] z-50 max-h-48 overflow-y-auto">
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
                      className="block w-full text-left px-3 py-2 text-xs text-zt-text-primary hover:bg-zt-bg-muted border-b border-zt-border last:border-b-0"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Encounter class */}
            <div className="text-[11px] text-zt-text-secondary mb-1">{tr("order.encounterClass")}</div>
            <select
              value={encounterClass}
              onChange={(e) => setEncounterClass(e.target.value)}
              className="w-full rounded-[7px] border border-zt-border bg-zt-bg-page px-2.5 py-[7px] text-xs text-zt-text-primary outline-none focus:border-zt-primary mb-3"
            >
              <option value="AMB">{tr("order.encounter_AMB")}</option>
              <option value="IMP">{tr("order.encounter_IMP")}</option>
              <option value="EMER">{tr("order.encounter_EMER")}</option>
              <option value="SS">{tr("order.encounter_SS")}</option>
              <option value="HH">{tr("order.encounter_HH")}</option>
              <option value="VR">{tr("order.encounter_VR")}</option>
            </select>

            {/* Clinical note */}
            <div className="text-[11px] text-zt-text-secondary mb-1">{tr("order.clinicalNote")}</div>
            <textarea
              value={clinicalNote}
              onChange={(e) => setClinicalNote(e.target.value)}
              placeholder={tr("order.clinicalNotePlaceholder")}
              rows={3}
              className="w-full rounded-[7px] border border-zt-border bg-zt-bg-page px-2.5 py-[7px] text-xs text-zt-text-primary placeholder:text-zt-text-tertiary outline-none focus:border-zt-primary resize-none"
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />
        </div>
      </div>

      {/* ── Status strip (reserved height — prevents CLS) ─────────────────── */}
      <div className="shrink-0 min-h-8 px-6 flex items-center bg-zt-bg-card border-t border-zt-border">
        {submitMsg && (
          <div className="text-xs text-zt-success bg-zt-success-light border border-zt-success-border px-2.5 py-1 rounded-lg">
            {submitMsg}
          </div>
        )}
        {submitErr && (
          <div className="text-xs text-zt-danger bg-zt-danger-light border border-zt-danger-border px-2.5 py-1 rounded-lg">
            {submitErr}
          </div>
        )}
      </div>

      {/* ── Action bar (fixed height — no layout shift ever) ─────────────── */}
      <div className="h-14 shrink-0 bg-zt-bg-card border-t border-zt-border flex items-center justify-between px-6 gap-3">

        {/* Left: preview + print tools */}
        <div className="flex items-center gap-2">
          {/* Technical previews */}
          <button
            type="button"
            onClick={() => openPreview("fhir")}
            disabled={selectedTests.length === 0}
            title="FHIR Bundle als JSON anzeigen"
            className="h-[34px] px-4 rounded-[8px] border border-zt-border bg-zt-bg-card text-[13px] text-zt-text-primary hover:bg-zt-bg-page disabled:text-zt-text-disabled disabled:cursor-not-allowed transition-colors"
          >
            {tr("order.fhirPreview")}
          </button>
          <button
            type="button"
            onClick={() => openPreview("hl7")}
            disabled={selectedTests.length === 0}
            title="HL7 ORM^O01 Nachricht anzeigen"
            className="h-[34px] px-4 rounded-[8px] border border-zt-border bg-zt-bg-card text-[13px] text-zt-text-primary hover:bg-zt-bg-page disabled:text-zt-text-disabled disabled:cursor-not-allowed transition-colors"
          >
            {tr("order.hl7Preview")}
          </button>

          {/* Separator */}
          <span className="h-5 w-px bg-zt-border mx-1" aria-hidden="true" />

          {/* Begleitschein */}
          <button
            type="button"
            onClick={() => printBegleitschein(generateOrderNumber())}
            disabled={selectedTests.length === 0}
            title="Begleitschein als Druckvorschau anzeigen"
            className="h-[34px] px-4 rounded-[8px] border border-zt-primary-border bg-zt-primary-light text-[13px] text-zt-primary hover:bg-zt-primary hover:text-zt-text-on-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            🖨 {tr("order.begleitschein")}
          </button>

          {/* Etikett drucken */}
          <button
            type="button"
            onClick={() => printLabel()}
            title="Probenetikett drucken"
            className="h-[34px] px-4 rounded-[8px] border border-zt-border bg-zt-bg-card text-[13px] text-zt-text-primary hover:bg-zt-bg-page transition-colors"
          >
            🏷 {tr("order.printLabel")}
          </button>
        </div>

        {/* Right: main actions */}
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <>
              <button
                type="button"
                onClick={() => saveDraft(selectedTests)}
                disabled={submitting}
                className="h-[34px] px-4 rounded-[8px] border border-zt-border bg-zt-bg-card text-[13px] text-zt-text-primary hover:bg-zt-bg-page disabled:opacity-50 transition-colors"
              >
                {tr("order.saveDraft")}
              </button>
              <button
                type="button"
                onClick={submitOrder}
                disabled={!canSubmit}
                className="h-[34px] px-4 rounded-[8px] bg-zt-primary text-[13px] font-medium text-zt-text-on-primary hover:bg-zt-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? tr("order.submitting") : tr("order.submit")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Preview modal ───────────────────────────────────────────────────── */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="bg-zt-bg-card rounded-lg border border-zt-border shadow-[var(--zt-shadow-lg)] flex flex-col"
            style={{ width: "860px", maxWidth: "95vw", height: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zt-border px-4 py-3">
              <span className="font-semibold text-zt-text-primary text-sm">
                {previewModal === "fhir" ? tr("order.fhirPreview") : tr("order.hl7Preview")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyPreview}
                  className={`px-3 py-1 rounded-[7px] text-xs border transition-colors ${
                    previewCopied
                      ? "bg-zt-success-light border-zt-success-border text-zt-success"
                      : "bg-zt-bg-card border-zt-border text-zt-text-secondary hover:bg-zt-bg-page"
                  }`}
                >
                  {previewCopied ? `✓ ${tr("order.copied")}` : `📋 ${tr("order.copy")}`}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="text-zt-text-tertiary hover:text-zt-text-primary text-xl leading-none px-1"
                  aria-label={tr("common.close")}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <pre className="h-full text-xs font-mono bg-gray-950 text-green-300 p-4 whitespace-pre overflow-auto">
                {previewContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
