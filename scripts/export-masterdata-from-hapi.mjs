/**
 * export-masterdata-from-hapi.mjs
 *
 * Fetches all Stammdaten from a live HAPI FHIR server and merges them
 * into seed/fhir/masterdata.json (upsert by resource ID).
 *
 * Usage:
 *   node scripts/export-masterdata-from-hapi.mjs [FHIR_BASE_URL]
 *
 * Examples:
 *   node scripts/export-masterdata-from-hapi.mjs https://hapi.2a01-4f8-1c1a-5842--1.nip.io/fhir
 *   node scripts/export-masterdata-from-hapi.mjs http://localhost:8080/fhir
 *
 * Resources exported: Organization, OrganizationAffiliation, Location,
 *                     Practitioner, PractitionerRole
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE  = path.join(__dirname, "../seed/fhir/masterdata.json");

// ── Config ────────────────────────────────────────────────────────────────────

const FHIR_BASE = process.argv[2] || "https://hapi.2a01-4f8-1c1a-5842--1.nip.io/fhir";

const RESOURCE_TYPES = [
  "Organization",
  "OrganizationAffiliation",
  "Location",
  "Practitioner",
  "PractitionerRole",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

async function fetchAll(resourceType) {
  const resources = [];
  let url = `${FHIR_BASE}/${resourceType}?_count=200`;

  while (url) {
    console.log(`  GET ${url}`);
    const res  = await fetch(url, { headers: { accept: "application/fhir+json" } });
    if (!res.ok) {
      console.warn(`  ⚠ ${resourceType}: HTTP ${res.status} — übersprungen`);
      return [];
    }
    const bundle = await res.json();
    for (const entry of bundle.entry ?? []) {
      if (entry.resource) resources.push(entry.resource);
    }
    // Follow next page link
    const next = (bundle.link ?? []).find(l => l.relation === "next");
    url = next?.url ?? null;
  }

  return resources;
}

function toTransactionEntry(resource) {
  return {
    resource,
    request: {
      method: "PUT",
      url:    `${resource.resourceType}/${resource.id}`,
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\nFHIR Base: ${FHIR_BASE}`);
console.log(`Output:    ${OUT_FILE}\n`);

// Load existing seed file
const existing = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
const existingMap = new Map();
for (const entry of existing.entry ?? []) {
  const key = `${entry.resource.resourceType}/${entry.resource.id}`;
  existingMap.set(key, entry);
}

// Fetch fresh data from HAPI
let added = 0;
let updated = 0;

for (const resourceType of RESOURCE_TYPES) {
  console.log(`▶ ${resourceType}`);
  const resources = await fetchAll(resourceType);
  console.log(`  → ${resources.length} Einträge gefunden`);

  for (const resource of resources) {
    if (!resource.id) continue;
    const key   = `${resource.resourceType}/${resource.id}`;
    const entry = toTransactionEntry(resource);
    if (existingMap.has(key)) {
      existingMap.set(key, entry);
      updated++;
    } else {
      existingMap.set(key, entry);
      added++;
    }
  }
}

// Rebuild entry array: Stammdaten types first, then ActivityDefinition last
const ORDER = ["Organization", "OrganizationAffiliation", "Location", "Practitioner", "PractitionerRole", "ActivityDefinition"];
const entries = [...existingMap.values()].sort((a, b) => {
  const ai = ORDER.indexOf(a.resource.resourceType);
  const bi = ORDER.indexOf(b.resource.resourceType);
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
});

existing.entry = entries;
fs.writeFileSync(OUT_FILE, JSON.stringify(existing, null, 2), "utf8");

// Summary
const byType = {};
for (const e of entries) {
  const rt = e.resource.resourceType;
  byType[rt] = (byType[rt] ?? 0) + 1;
}

console.log("\n✅ masterdata.json aktualisiert:");
Object.entries(byType).forEach(([t, c]) => console.log(`   ${t}: ${c}`));
console.log(`   Neu: ${added} | Aktualisiert: ${updated} | Total: ${entries.length}`);
