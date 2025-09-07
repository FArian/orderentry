"use client";

import { useEffect, useMemo, useState } from "react";

// Minimal FHIR Patient typing for fields we display
type HumanName = {
  text?: string;
  given?: string[];
  family?: string;
  prefix?: string[];
  suffix?: string[];
};
type Address = {
  text?: string;
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};
type Coding = { display?: string };
type CodeableConcept = { text?: string; coding?: Coding[] };
type Telecom = { system?: string; value?: string; use?: string };
type Identifier = {
  system?: string;
  value?: string;
  assigner?: { display?: string };
  type?: CodeableConcept;
};
type Patient = {
  resourceType: "Patient";
  id?: string;
  active?: boolean;
  name?: HumanName[];
  gender?: string;
  birthDate?: string;
  address?: Address[];
  telecom?: Telecom[];
  identifier?: Identifier[];
  maritalStatus?: CodeableConcept;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  managingOrganization?: { display?: string; reference?: string };
  meta?: { lastUpdated?: string };
};

function formatDate(date?: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function nameToString(names?: HumanName[]): string {
  if (!names || names.length === 0) return "Unbekannt";
  const n = names[0];
  if (n.text && n.text.trim()) return n.text.trim();
  const parts = [
    ...(n.prefix || []),
    ...(n.given || []),
    n.family || "",
    ...(n.suffix || []),
  ].filter(Boolean);
  return parts.join(" ") || "Unbekannt";
}

function addressToString(addrs?: Address[]): string {
  if (!addrs || addrs.length === 0) return "";
  const a = addrs[0];
  if (a.text && a.text.trim()) return a.text.trim();
  const parts = [
    ...(a.line || []),
    a.postalCode,
    a.city,
    a.state,
    a.country,
  ].filter(Boolean);
  return parts.join(", ");
}

function genderLabel(g?: string): string {
  switch (g) {
    case "male":
      return "Männlich";
    case "female":
      return "Weiblich";
    case "other":
      return "Divers";
    case "unknown":
      return "Unbekannt";
    default:
      return g || "";
  }
}

function systemLabel(system?: string): string {
  switch (system) {
    case "phone":
      return "Telefon";
    case "email":
      return "E‑Mail";
    case "fax":
      return "Fax";
    case "url":
      return "Web";
    default:
      return "Kontakt";
  }
}

function labelForUse(use?: string): string | undefined {
  switch (use) {
    case "home":
      return "privat";
    case "work":
      return "geschäftlich";
    case "mobile":
      return "mobil";
    case "temp":
      return "temporär";
    case "old":
      return "alt";
    default:
      return use || undefined;
  }
}

export default function PatientDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/patients/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const json = (await res.json()) as Patient;
        setData(json);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const rows = useMemo(() => {
    const p = data;
    if (!p) return [] as Array<{ label: string; value: string }>;
    const list: Array<{ label: string; value: string }> = [];
    list.push({ label: "Patienten-ID", value: p.id || "-" });
    if (typeof p.active === "boolean")
      list.push({ label: "Aktiv", value: p.active ? "Ja" : "Nein" });
    if (p.name && p.name.length)
      list.push({ label: "Name", value: nameToString(p.name) });
    if (p.gender)
      list.push({ label: "Geschlecht", value: genderLabel(p.gender) });
    if (p.birthDate)
      list.push({ label: "Geburtsdatum", value: formatDate(p.birthDate) });
    if (p.address && p.address.length)
      list.push({ label: "Adresse", value: addressToString(p.address) });
    if (p.telecom && p.telecom.length) {
      p.telecom.forEach((t) => {
        const labelBase = systemLabel(t.system);
        const variant = labelForUse(t.use);
        const label = variant ? `${labelBase} (${variant})` : labelBase;
        if (t.value) list.push({ label, value: t.value });
      });
    }
    if (p.identifier && p.identifier.length) {
      const idf = p.identifier
        .map((i) => [i.system, i.value].filter(Boolean).join(": "))
        .join("; ");
      if (idf) list.push({ label: "Kennungen", value: idf });
    }
    if (p.maritalStatus) {
      const ms = p.maritalStatus.text || p.maritalStatus.coding?.[0]?.display;
      if (ms) list.push({ label: "Familienstand", value: ms });
    }
    if (typeof p.deceasedBoolean === "boolean")
      list.push({
        label: "Verstorben",
        value: p.deceasedBoolean ? "Ja" : "Nein",
      });
    if (p.deceasedDateTime)
      list.push({
        label: "Verstorben am",
        value: formatDate(p.deceasedDateTime),
      });
    if (p.managingOrganization?.display)
      list.push({
        label: "Einrichtung",
        value: p.managingOrganization.display,
      });
    if (p.meta?.lastUpdated)
      list.push({
        label: "Letzte Aktualisierung",
        value: formatDate(p.meta.lastUpdated),
      });
    return list;
  }, [data]);

  if (loading) return <div className="text-gray-600">Laden…</div>;
  if (error)
    return <div className="text-red-600">Fehler beim Laden: {error}</div>;
  if (!data) return null;

  // Extract fields for the two-column summary
  const leftCol = [
    { label: "Geschlecht", value: genderLabel(data.gender) },
    { label: "Name", value: nameToString(data.name) },
    { label: "Geburtsdatum", value: formatDate(data.birthDate) },
  ];

  function pickIdentifier(includes: string[]): Identifier | undefined {
    const lowerIncludes = includes.map((s) => s.toLowerCase());
    return (data.identifier || []).find((i) =>
      lowerIncludes.some(
        (s) =>
          (i.system || "").toLowerCase().includes(s) ||
          (i.type?.text || "").toLowerCase().includes(s)
      )
    );
  }

  // Prefer identifier[1] for insurance details per spec: identifier[1].assigner.display is Krankenkasse
  const explicitInsurance = (data.identifier || [])[1];
  const insuranceId =
    explicitInsurance ||
    pickIdentifier([
      "insurance",
      "versich",
      "krankenkasse",
      "payor",
      "kvg",
      "kk",
    ]);
  const cardId = pickIdentifier([
    "card",
    "karte",
    "versicherungskarte",
    "versichertencard",
  ]);

  const insurerName =
    insuranceId?.assigner?.display || data.managingOrganization?.display || "";
  const insuredNumber = insuranceId?.value || "";
  const cardNumber = cardId?.value || "";

  const rightCol = [
    { label: "Krankenkasse", value: insurerName },
    { label: "Versicherten-Nummer", value: insuredNumber },
    { label: "Versicherungskarten-Nr.", value: cardNumber },
  ];

  return (
    <div>
      {/* Top: two-column patient summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <dl className="divide-y divide-gray-200">
          {leftCol.map((r) => (
            <div key={r.label} className="py-2 grid grid-cols-3 gap-4">
              <dt className="text-sm text-gray-500">{r.label}</dt>
              <dd className="text-sm text-gray-900 col-span-2">
                {r.value || "-"}
              </dd>
            </div>
          ))}
        </dl>
        <dl className="divide-y divide-gray-200">
          {rightCol.map((r) => (
            <div key={r.label} className="py-2 grid grid-cols-3 gap-4">
              <dt className="text-sm text-gray-500">{r.label}</dt>
              <dd className="text-sm text-gray-900 col-span-2">
                {r.value || "-"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
          Alle Daten (JSON) anzeigen
        </summary>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 p-4 text-xs overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
