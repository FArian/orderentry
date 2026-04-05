#!/usr/bin/env node
/**
 * scripts/fhir-seed.mjs
 *
 * FHIR bootstrap loader — runs on container startup BEFORE server.js.
 *
 * Responsibilities:
 *   1. Wait for the FHIR server to become reachable (retry with back-off).
 *   2. Check if masterdata already exists at the expected seed version.
 *   3. If missing or outdated → POST the masterdata bundle (idempotent PUT).
 *   4. If FHIR__SEED_DEMO=true → also POST the demo-data bundle.
 *
 * ENV vars read:
 *   ORDERENTRY_FHIR__BASE_URL  — FHIR R4 base URL (preferred)
 *   FHIR_BASE_URL              — legacy / docker-compose alias
 *   ORDERENTRY_FHIR__SEED_ENABLED — "true" to enable seeding (default: true)
 *   ORDERENTRY_FHIR__SEED_DEMO    — "true" to also load demo data (default: false)
 *   ORDERENTRY_FHIR__AUTH_TYPE    — none | bearer | basic (default: none)
 *   ORDERENTRY_FHIR__AUTH_TOKEN   — bearer token (when AUTH_TYPE=bearer)
 *   ORDERENTRY_FHIR__AUTH_USER    — username (when AUTH_TYPE=basic)
 *   ORDERENTRY_FHIR__AUTH_PASSWORD — password (when AUTH_TYPE=basic)
 *
 * Exit codes:
 *   Always exits 0 — server.js starts regardless of seed outcome.
 *   Seed failures are logged as warnings, never fatal.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Constants ─────────────────────────────────────────────────────────────────

const SEED_VERSION     = "v1";
const CATALOG_VERSION  = "catalog-v1";
const DEMO_VERSION     = "demo-v1";
const SEED_TAG_SYSTEM  = "https://www.zetlab.ch/fhir/seed";
/** Anchor resource used to detect whether masterdata is already seeded. */
const ANCHOR_RESOURCE  = "Organization/zlz";
/** Anchor resource used to detect whether catalog is already seeded. */
const CATALOG_ANCHOR   = "ActivityDefinition/actdef-CRP";

const MAX_RETRIES     = 12;
const RETRY_DELAY_MS  = 5_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reads an env var by its namespaced name (ORDERENTRY_*). */
function e(key) {
  const prefix = (process.env.APP_NAME ?? "ORDERENTRY").toUpperCase();
  return process.env[`${prefix}_${key}`];
}

function bool(value, fallback = false) {
  if (!value) return fallback;
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

function info(msg)    { console.log(`[FHIR-SEED] ℹ  ${msg}`); }
function ok(msg)      { console.log(`[FHIR-SEED] ✓  ${msg}`); }
function warn(msg)    { console.warn(`[FHIR-SEED] ⚠  ${msg}`); }
function skip(msg)    { console.log(`[FHIR-SEED] ⏭  ${msg}`); }
function created(msg) { console.log(`[FHIR-SEED] ✚  ${msg}`); }

// ── Configuration ─────────────────────────────────────────────────────────────

const fhirBase = (
  e("FHIR__BASE_URL") ||
  process.env.FHIR_BASE_URL ||
  "http://localhost:8080/fhir"
).replace(/\/$/, "");

const seedEnabled  = bool(e("FHIR__SEED_ENABLED"),  true);
const seedCatalog  = bool(e("FHIR__SEED_CATALOG"), false);
const seedDemo     = bool(e("FHIR__SEED_DEMO"),    false);

// ── Auth headers ──────────────────────────────────────────────────────────────

function buildHeaders() {
  const headers = {
    "Content-Type": "application/fhir+json",
    "Accept":       "application/fhir+json",
  };

  const authType = (e("FHIR__AUTH_TYPE") ?? "none").toLowerCase();

  if (authType === "bearer") {
    const token = e("FHIR__AUTH_TOKEN") ?? "";
    if (token) headers["Authorization"] = `Bearer ${token}`;

  } else if (authType === "basic") {
    const user = e("FHIR__AUTH_USER") ?? "";
    const pass = e("FHIR__AUTH_PASSWORD") ?? "";
    if (user) {
      const encoded = Buffer.from(`${user}:${pass}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
    }
  }

  return headers;
}

// ── FHIR availability check ───────────────────────────────────────────────────

async function waitForFhir() {
  const metaUrl = `${fhirBase}/metadata`;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(metaUrl, {
        headers: buildHeaders(),
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok || res.status === 401) {
        ok(`FHIR server reachable at ${fhirBase}`);
        return true;
      }
      warn(`FHIR /metadata returned ${res.status} (attempt ${attempt}/${MAX_RETRIES})`);
    } catch (err) {
      warn(`FHIR not reachable yet: ${err.message} (attempt ${attempt}/${MAX_RETRIES})`);
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  return false;
}

// ── Version check ─────────────────────────────────────────────────────────────

/**
 * Checks the seed version tag on the anchor resource.
 * Returns the current tag code, or null if the resource does not exist yet.
 */
async function getCurrentSeedVersion() {
  try {
    const res = await fetch(`${fhirBase}/${ANCHOR_RESOURCE}`, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(8_000),
    });

    if (res.status === 404) return null;

    if (!res.ok) {
      warn(`Could not read ${ANCHOR_RESOURCE}: HTTP ${res.status}`);
      return null;
    }

    const resource = await res.json();
    const tags = resource?.meta?.tag ?? [];
    const seedTag = tags.find((t) => t.system === SEED_TAG_SYSTEM);
    return seedTag?.code ?? null;
  } catch (err) {
    warn(`Version check failed: ${err.message}`);
    return null;
  }
}

/**
 * Checks whether the catalog anchor resource exists.
 * Returns the seed tag code, or null if not yet seeded.
 */
async function getCurrentCatalogVersion() {
  try {
    const res = await fetch(`${fhirBase}/${CATALOG_ANCHOR}`, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const resource = await res.json();
    const tags = resource?.meta?.tag ?? [];
    const tag = tags.find((t) => t.system === SEED_TAG_SYSTEM);
    return tag?.code ?? CATALOG_VERSION; // exists but no tag → treat as current
  } catch {
    return null;
  }
}

/**
 * Checks the demo version tag on the first demo patient.
 */
async function getCurrentDemoVersion() {
  try {
    const res = await fetch(`${fhirBase}/Patient/demo-001`, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(8_000),
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const resource = await res.json();
    const tags = resource?.meta?.tag ?? [];
    const demoTag = tags.find((t) => t.system === SEED_TAG_SYSTEM);
    return demoTag?.code ?? null;
  } catch {
    return null;
  }
}

// ── Bundle loader ─────────────────────────────────────────────────────────────

function loadBundle(filename) {
  const path = resolve(ROOT, "seed", "fhir", filename);
  if (!existsSync(path)) {
    throw new Error(`Seed file not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Posts a FHIR transaction bundle and returns a summary of created/updated resources.
 */
async function postBundle(bundle) {
  const res = await fetch(fhirBase, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(bundle),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Bundle POST failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
  }

  const responseBundle = await res.json();
  return summariseResponse(responseBundle, bundle);
}

function summariseResponse(responseBundle, requestBundle) {
  const entries = responseBundle?.entry ?? [];
  const summary = { created: 0, updated: 0, ok: 0, errors: [] };

  for (let i = 0; i < entries.length; i++) {
    const entry   = entries[i];
    const status  = entry?.response?.status ?? "";
    const reqUrl  = requestBundle?.entry?.[i]?.request?.url ?? `entry[${i}]`;

    if (status.startsWith("201")) {
      summary.created++;
      created(`  ${reqUrl}`);
    } else if (status.startsWith("200") || status.startsWith("204")) {
      summary.updated++;
      skip(`  ${reqUrl} (unchanged or updated)`);
    } else if (status.startsWith("4") || status.startsWith("5")) {
      const detail = entry?.response?.outcome?.issue?.[0]?.details?.text ?? status;
      summary.errors.push(`${reqUrl}: ${detail}`);
    } else {
      summary.ok++;
      skip(`  ${reqUrl} (${status})`);
    }
  }

  return summary;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[FHIR-SEED] ══════════════════════════════════════════");
  console.log("[FHIR-SEED]  z2Lab OrderEntry — FHIR Seed Bootstrap");
  console.log("[FHIR-SEED] ══════════════════════════════════════════");

  if (!seedEnabled) {
    skip("Seeding disabled (FHIR__SEED_ENABLED=false)");
    return;
  }

  info(`FHIR server: ${fhirBase}`);
  info(`Seed version: ${SEED_VERSION}`);
  info(`Demo data:   ${seedDemo ? "enabled" : "disabled"}`);

  // ── 1. Wait for FHIR server ─────────────────────────────────────────────────
  const reachable = await waitForFhir();
  if (!reachable) {
    warn(`FHIR server not reachable after ${MAX_RETRIES} attempts. Skipping seed.`);
    warn("OrderEntry will start but masterdata may be missing.");
    warn("Re-run: docker exec orderentry node /app/scripts/fhir-seed.mjs");
    return;
  }

  // ── 2. Masterdata version check ─────────────────────────────────────────────
  info(`Checking masterdata version (${ANCHOR_RESOURCE})…`);
  const currentVersion = await getCurrentSeedVersion();

  if (currentVersion === SEED_VERSION) {
    skip(`Masterdata already at version ${SEED_VERSION} — skipping.`);
  } else {
    if (currentVersion === null) {
      info("Masterdata not found — loading for the first time…");
    } else {
      info(`Masterdata version mismatch: found ${currentVersion}, expected ${SEED_VERSION} — updating…`);
    }

    try {
      const bundle  = loadBundle("masterdata.json");
      const total   = bundle?.entry?.length ?? 0;
      info(`Posting masterdata bundle (${total} resources)…`);

      const summary = await postBundle(bundle);
      ok(`Masterdata seeded: ${summary.created} created, ${summary.updated} updated.`);

      if (summary.errors.length > 0) {
        for (const e of summary.errors) warn(`  Error: ${e}`);
      }
    } catch (err) {
      warn(`Masterdata seed failed: ${err.message}`);
      warn("OrderEntry will start — fix the FHIR server and re-run the seed script.");
    }
  }

  // ── 3. Catalog (ActivityDefinition / ObservationDefinition / SpecimenDefinition) ──
  if (!seedCatalog) {
    skip("Katalog-Seed deaktiviert (FHIR__SEED_CATALOG=false).");
  } else {
    info(`Checking catalog version (${CATALOG_ANCHOR})…`);
    const currentCatalogVersion = await getCurrentCatalogVersion();

    if (currentCatalogVersion === CATALOG_VERSION) {
      skip(`Katalog bereits auf Version ${CATALOG_VERSION} — übersprungen.`);
    } else {
      if (currentCatalogVersion === null) {
        info("Katalog nicht gefunden — wird erstmalig geladen…");
      } else {
        info(`Katalog-Version: ${currentCatalogVersion} → ${CATALOG_VERSION} — wird aktualisiert…`);
      }

      try {
        const bundle = loadBundle("catalog.json");
        const total  = bundle?.entry?.length ?? 0;
        info(`Posting catalog bundle (${total} Ressourcen)…`);
        const summary = await postBundle(bundle);
        ok(`Katalog geladen: ${summary.created} erstellt, ${summary.updated} aktualisiert.`);
        if (summary.errors.length > 0) {
          for (const e of summary.errors) warn(`  Fehler: ${e}`);
        }
      } catch (err) {
        warn(`Katalog-Seed fehlgeschlagen: ${err.message}`);
      }
    }
  }

  // ── 4. Demo data ────────────────────────────────────────────────────────────
  if (!seedDemo) {
    skip("Demo data disabled (FHIR__SEED_DEMO=false).");
    return;
  }

  info("Checking demo data version (Patient/demo-001)…");
  const currentDemoVersion = await getCurrentDemoVersion();

  if (currentDemoVersion === DEMO_VERSION) {
    skip(`Demo data already at version ${DEMO_VERSION} — skipping.`);
  } else {
    if (currentDemoVersion === null) {
      info("Demo data not found — loading…");
    } else {
      info(`Demo data version mismatch: found ${currentDemoVersion}, expected ${DEMO_VERSION} — updating…`);
    }

    try {
      const bundle  = loadBundle("demo-data.json");
      const total   = bundle?.entry?.length ?? 0;
      info(`Posting demo-data bundle (${total} resources)…`);

      const summary = await postBundle(bundle);
      ok(`Demo data seeded: ${summary.created} created, ${summary.updated} updated.`);

      if (summary.errors.length > 0) {
        for (const e of summary.errors) warn(`  Error: ${e}`);
      }
    } catch (err) {
      warn(`Demo data seed failed: ${err.message}`);
    }
  }
}

main().catch((err) => {
  warn(`Unexpected seed error: ${err.message}`);
}).finally(() => {
  console.log("[FHIR-SEED] ══════════════════════════════════════════");
  console.log("[FHIR-SEED]  Seed complete — starting server...");
  console.log("[FHIR-SEED] ══════════════════════════════════════════");
});
