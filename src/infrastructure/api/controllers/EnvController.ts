/**
 * EnvController — handles GET /api/env and POST /api/env.
 *
 * Cross-environment design:
 *  - GET  reads from `process.env` directly — works on Vercel and Docker alike,
 *         and always reflects the values the running process actually sees.
 *  - POST writes to `.env.local` on disk — only meaningful where the filesystem
 *         is writable (local dev, Docker). On Vercel (read-only FS) it returns
 *         405 Method Not Allowed with a clear explanation.
 *
 * Only variables on the ALLOWED_KEYS whitelist are exposed or modified.
 * Secrets such as AUTH_SECRET are never included.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parseEnvFile, applyEnvUpdates } from "@/shared/utils/envParser";
import { envKey } from "@/infrastructure/config/EnvConfig";
import type {
  GetEnvResponseDto,
  UpdateEnvRequestDto,
  UpdateEnvResponseDto,
  EnvSchemaResponseDto,
} from "../dto/EnvDto";

// ── Whitelist ─────────────────────────────────────────────────────────────────

/**
 * Explicit whitelist of server-side keys that may be read and written via the API.
 * Keys are built dynamically via envKey() so renaming APP_NAME updates them all.
 * NEXT_PUBLIC_* keys are always allowed (checked dynamically in isAllowed()).
 *
 * To expose a new variable:
 *  1. Add envKey("SERVICE__KEY") here.
 *  2. Add the corresponding EnvConfig getter in infrastructure/config/EnvConfig.ts.
 *  3. Document it in the Environment Variables table in CLAUDE.md.
 */
const ALLOWED_SERVER_KEYS = new Set([
  // FHIR
  envKey("FHIR__BASE_URL"),
  envKey("FHIR__SYSTEM_GLN"),
  envKey("FHIR__SYSTEM_AHV"),
  envKey("FHIR__SYSTEM_VEKA"),
  envKey("FHIR__SYSTEM_ZSR"),
  envKey("FHIR__SYSTEM_UID"),
  envKey("FHIR__SYSTEM_BUR"),
  envKey("FHIR__SYSTEM_CATEGORY"),
  envKey("FHIR__AUTH_TYPE"),
  // Auth
  envKey("AUTH__ALLOW_LOCAL"),
  envKey("AUTH__SESSION_IDLE_TIMEOUT"),
  // Database — DATABASE_URL excluded (may contain password; use /api/health/db instead)
  envKey("DB__PROVIDER"),
  // Logging
  envKey("LOG__LEVEL"),
  envKey("LOG__FILE"),
  // Observability
  envKey("TRACING__ENABLED"),
  envKey("TRACING__URL"),
  envKey("TRACING__LABEL"),
  envKey("MONITORING__URL"),
  envKey("MONITORING__LABEL"),
  // External APIs
  envKey("SASIS__API_BASE"),
  envKey("REFDATA__SOAP_URL"),
  // Orchestra HL7 proxy
  envKey("ORCHESTRA__HL7_BASE"),
  envKey("ORCHESTRA__HL7_INBOUND_PATH"),
  envKey("ORCHESTRA__HL7_OUTBOUND_PATH"),
  // Order service types
  envKey("ORDER__SERVICE_TYPES"),
  // Security
  envKey("AUTH__SESSION_IDLE_TIMEOUT"),
  // Labor / Organisation
  envKey("LAB__ORG_ID"),
  envKey("LAB__NAME"),
  envKey("LAB__INTERNAL_ORG_IDS"),
  // SNOMED Codes — PractitionerRole
  envKey("SNOMED__ROLE_INTERNAL"),
  envKey("SNOMED__ROLE_ORG_ADMIN"),
  envKey("SNOMED__ROLE_PHYSICIAN"),
  // SNOMED Codes — Organization Type
  envKey("SNOMED__ORG_LABORATORY"),
  envKey("SNOMED__ORG_HOSPITAL"),
  envKey("SNOMED__ORG_OUTPATIENT"),
  envKey("SNOMED__ORG_HOLDING"),
]);

/** Patterns in key names that are always blocked, regardless of whitelist. */
const BLOCKED_PATTERNS = [/SECRET/i, /PASSWORD/i, /TOKEN/i, /PRIVATE/i];

function isAllowed(key: string): boolean {
  if (BLOCKED_PATTERNS.some((re) => re.test(key))) return false;
  return key.startsWith("NEXT_PUBLIC_") || ALLOWED_SERVER_KEYS.has(key);
}

/** True when running inside a Vercel serverless environment. */
function isVercel(): boolean {
  return !!process.env.VERCEL;
}

// ── Static schema — all ENV vars the app understands ─────────────────────────

/**
 * Complete catalog of every environment variable the application supports.
 * This is the authoritative reference — update whenever a new var is added.
 *
 * Fields:
 *   key             — exact env var name
 *   description     — what it controls
 *   default         — value used when the var is not set
 *   required        — true if the app degrades significantly without it
 *   writable        — can be edited via POST /api/env
 *   restartRequired — process restart needed for the change to take effect
 *   secret          — value is masked in the API response (matches BLOCKED_PATTERNS)
 *   group           — logical category
 */
const ENV_SCHEMA: ReadonlyArray<{
  key:             string;
  description:     string;
  default:         string;
  required:        boolean;
  writable:        boolean;
  restartRequired: boolean;
  secret:          boolean;
  group:           string;
}> = [
  // ── FHIR ───────────────────────────────────────────────────────────────────
  {
    key:             envKey("FHIR__BASE_URL"),
    description:     "Base URL of the HAPI FHIR R4 server. Used by all FHIR proxy routes.",
    default:         "http://localhost:8080/fhir",
    required:        true,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "FHIR",
  },
  // ── FHIR Identifier Systems ────────────────────────────────────────────────
  {
    key:             envKey("FHIR__SYSTEM_GLN"),
    description:     "FHIR identifier system URI for GS1 Global Location Number (GLN). Used for Practitioner and Organization identifier searches.",
    default:         "https://www.gs1.org/gln",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "FHIR",
  },
  {
    key:             envKey("FHIR__SYSTEM_AHV"),
    description:     "FHIR identifier system URI for Swiss AHV/AVS Social Security Number.",
    default:         "urn:oid:2.16.756.5.32",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "FHIR",
  },
  {
    key:             envKey("FHIR__SYSTEM_VEKA"),
    description:     "FHIR identifier system URI for Swiss VeKa insurance card number.",
    default:         "urn:oid:2.16.756.5.30.1.123.100.1.1",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "FHIR",
  },
  {
    key:             envKey("FHIR__SYSTEM_ZSR"),
    description:     "FHIR identifier system URI for santésuisse Zahlstellenregister (ZSR).",
    default:         "urn:oid:2.16.756.5.30.1.123.100.2.1.1",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "FHIR",
  },
  {
    key:             envKey("FHIR__SYSTEM_UID"),
    description:     "FHIR identifier system URI for Swiss Unternehmens-Identifikation (UID / CHE-number).",
    default:         "urn:oid:2.16.756.5.35",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "FHIR",
  },
  {
    key:             envKey("FHIR__SYSTEM_BUR"),
    description:     "FHIR identifier system URI for Swiss Betriebseinheitsnummer BFS (BUR).",
    default:         "urn:oid:2.16.756.5.45",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "FHIR",
  },
  {
    key:             envKey("FHIR__SYSTEM_CATEGORY"),
    description:
      "FHIR identifier system URI used in ActivityDefinition.topic.coding to identify " +
      "ZetLab service categories (e.g. MIBI, ROUTINE, POC). " +
      "Only codings matching this system are returned by GET /api/v1/config/service-types.",
    default:         "https://www.zetlab.ch/fhir/category",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "FHIR",
  },
  // ── Authentication ─────────────────────────────────────────────────────────
  {
    key:             envKey("AUTH__SECRET"),
    description:     "HMAC-SHA256 signing secret for session cookies. Must be ≥32 chars in production.",
    default:         "dev-secret-change-me",
    required:        true,
    writable:        false,
    restartRequired: true,
    secret:          true,
    group:           "Authentication",
  },
  {
    key:             envKey("AUTH__ALLOW_LOCAL"),
    description:     "Set true to allow the unsigned localSession cookie (browser-only auth fallback).",
    default:         "false",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Authentication",
  },
  {
    key:             envKey("AUTH__SESSION_IDLE_TIMEOUT"),
    description:     "Automatische Abmeldung nach Inaktivität (Minuten). 0 = deaktiviert. Empfehlung für Medizinsoftware: 15–30 Minuten.",
    default:         "30",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Authentication",
  },
  {
    key:             envKey("ORCHESTRA__JWT_SECRET"),
    description:     "Shared HS256 secret for /api/launch JWT validation from Orchestra. Generate: openssl rand -hex 32",
    default:         "",
    required:        false,
    writable:        false,
    restartRequired: true,
    secret:          true,
    group:           "Authentication",
  },
  // ── Database ───────────────────────────────────────────────────────────────
  {
    key:             envKey("DB__PROVIDER"),
    description:     "Database engine: sqlite (default) | postgresql | sqlserver. DATABASE_URL must match the provider.",
    default:         "sqlite",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Database",
  },
  // ── Logging ────────────────────────────────────────────────────────────────
  {
    key:             envKey("LOG__LEVEL"),
    description:     "Minimum log level. Accepted values: debug | info | warn | error | silent",
    default:         "info",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Logging",
  },
  {
    key:             envKey("LOG__FILE"),
    description:     "Absolute path to append structured JSON log lines. Empty = file logging disabled.",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Logging",
  },
  // ── Observability ──────────────────────────────────────────────────────────
  {
    key:             envKey("TRACING__ENABLED"),
    description:     "Set true to activate OpenTelemetry distributed tracing. Requires TRACING__URL.",
    default:         "false",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Observability",
  },
  {
    key:             envKey("TRACING__URL"),
    description:     "OTLP/HTTP collector base URL for distributed tracing (e.g. http://jaeger:4318). Active only when TRACING__ENABLED=true.",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Observability",
  },
  {
    key:             envKey("TRACING__LABEL"),
    description:     "Display label for the tracing system shown in Admin → System (e.g. Jaeger, Tempo).",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Observability",
  },
  {
    key:             envKey("MONITORING__URL"),
    description:     "Monitoring dashboard base URL displayed in the Settings page (e.g. http://grafana:3000). Display-only link.",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Observability",
  },
  {
    key:             envKey("MONITORING__LABEL"),
    description:     "Display label for the monitoring system shown in Admin → System (e.g. Grafana, Prometheus).",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Observability",
  },
  {
    key:             envKey("METRICS__TOKEN"),
    description:     "Static Bearer token for the Prometheus scraper (GET /api/metrics). If not set, standard admin auth is used. Generate: openssl rand -hex 32",
    default:         "",
    required:        false,
    writable:        false,
    restartRequired: true,
    secret:          true,
    group:           "Observability",
  },
  // ── External APIs ──────────────────────────────────────────────────────────
  {
    key:             envKey("SASIS__API_BASE"),
    description:     "SASIS/OFAC VeKa card lookup API base URL (via Orchestra middleware). Empty = feature disabled.",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "External APIs",
  },
  {
    key:             envKey("REFDATA__SOAP_URL"),
    description:     "RefData SOAP endpoint for GLN partner lookups. Default: production RefData web service. Override for staging or mock.",
    default:         "https://refdatabase.refdata.ch/Service/Partner.asmx",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "External APIs",
  },
  // ── Orchestra / HL7 Proxy ─────────────────────────────────────────────────
  {
    key:             envKey("ORCHESTRA__HL7_BASE"),
    description:     "Base URL of the Orchestra HL7 API (e.g. http://orchestra:8019). Empty = HL7 proxy disabled.",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Orchestra",
  },
  {
    key:             envKey("ORCHESTRA__HL7_INBOUND_PATH"),
    description:     "Orchestra path for receiving inbound HL7 messages from the Edge agent.",
    default:         "/api/v1/in/hl7",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Orchestra",
  },
  {
    key:             envKey("ORCHESTRA__HL7_OUTBOUND_PATH"),
    description:     "Orchestra path for retrieving outbound HL7 result messages (ORU).",
    default:         "/api/v1/out/hl7",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Orchestra",
  },
  // ── Order Service Types ───────────────────────────────────────────────────
  {
    key:             envKey("ORDER__SERVICE_TYPES"),
    description:
      "Comma-separated list of active order service types. " +
      "Overrides the FHIR ActivityDefinition.topic auto-discovery for GET /api/v1/config/service-types. " +
      "Example: MIBI,ROUTINE,POC,CHEMO. If unset, service types are read live from FHIR (5-min cache) " +
      "with fallback to built-in defaults [MIBI, ROUTINE, POC].",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Order Service Types",
  },
  // ── Labor / Organisation ──────────────────────────────────────────────────
  {
    key:             envKey("LAB__ORG_ID"),
    description:
      "FHIR Resource-ID der Labororganisation. Wird serverseitig für Organization/-Referenzen verwendet. " +
      "Format: FHIR-valide Zeichen [A-Za-z0-9\\-\\.]{1,64}. " +
      "Empfehlung: <Kürzel>-<GLN> z.B. ZLZ-7601009336904. " +
      "Fallback auf NEXT_PUBLIC_LAB_ORG_ID wenn nicht gesetzt.",
    default:         "ZLZ-7601009336904",
    required:        true,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Labor",
  },
  {
    key:             envKey("LAB__NAME"),
    description:
      "Anzeigename des Labors für FHIR Organization.name, Begleitscheine und HL7-Nachrichten. " +
      "Fallback auf NEXT_PUBLIC_LAB_NAME wenn nicht gesetzt.",
    default:         "ZLZ Zentrallabor AG",
    required:        true,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Labor",
  },
  // ── Access Control ────────────────────────────────────────────────────────
  {
    key:             envKey("LAB__INTERNAL_ORG_IDS"),
    description:
      "Komma-getrennte FHIR Organization-IDs die als intern gelten (ZLZ/ZetLab). " +
      "Practitioners mit einer PractitionerRole in einer dieser Orgs erhalten Level A (vollen Zugriff).",
    default:         "zlz,zetlab,zlz-notfall",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Zugriffssteuerung",
  },
  // ── SNOMED Codes — PractitionerRole ───────────────────────────────────────
  {
    key:             envKey("SNOMED__ROLE_INTERNAL"),
    description:
      "Komma-getrennte SNOMED CT Codes für interne Labor-Mitarbeiter (Level A — voller Zugriff). " +
      "Standard: 159418007 (Medical laboratory technician), 159011000 (Pathologist).",
    default:         "159418007,159011000",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "SNOMED Codes",
  },
  {
    key:             envKey("SNOMED__ROLE_ORG_ADMIN"),
    description:
      "Komma-getrennte SNOMED CT Codes für Org-Admins (Level B — Zugriff auf alle Patienten der eigenen Org). " +
      "Standard: 224608005 (Administrative officer), 394572006 (Medical secretary).",
    default:         "224608005,394572006",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "SNOMED Codes",
  },
  {
    key:             envKey("SNOMED__ROLE_PHYSICIAN"),
    description:
      "Komma-getrennte SNOMED CT Codes für externe Ärzte (Level C — nur eigene Patienten). " +
      "Standard: 309343006 (Physician), 59058001 (General physician), 106289002 (Dental surgeon).",
    default:         "309343006,59058001,106289002",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "SNOMED Codes",
  },
  // ── SNOMED Codes — Organization Type ─────────────────────────────────────
  {
    key:             envKey("SNOMED__ORG_LABORATORY"),
    description:
      "SNOMED CT Code für klinisches Labor (Organization.type). " +
      "Standard: 708175003 (Clinical pathology laboratory).",
    default:         "708175003",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "SNOMED Codes",
  },
  {
    key:             envKey("SNOMED__ORG_HOSPITAL"),
    description:
      "SNOMED CT Code für Krankenhaus (Organization.type). " +
      "Standard: 22232009 (Hospital).",
    default:         "22232009",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "SNOMED Codes",
  },
  {
    key:             envKey("SNOMED__ORG_OUTPATIENT"),
    description:
      "SNOMED CT Code für ambulante Klinik / Praxis (Organization.type). " +
      "Standard: 33022008 (Outpatient clinic).",
    default:         "33022008",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "SNOMED Codes",
  },
  {
    key:             envKey("SNOMED__ORG_HOLDING"),
    description:
      "SNOMED CT Code für Konzern / Holding-Organisation (Organization.type). " +
      "Standard: 224891009 (Healthcare organisation).",
    default:         "224891009",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "SNOMED Codes",
  },
  // ── Build-time (NEXT_PUBLIC_*) ─────────────────────────────────────────────
  {
    key:             "NEXT_PUBLIC_APP_VERSION",
    description:     "Application version string (auto-generated by write-version.mjs from git metadata).",
    default:         "0.0.0-dev",
    required:        false,
    writable:        false,
    restartRequired: false,
    secret:          false,
    group:           "Build-time",
  },
  {
    key:             "NEXT_PUBLIC_FORCE_LOCAL_AUTH",
    description:     "Set true to force browser-only localStorage auth (ignores session cookies).",
    default:         "false",
    required:        false,
    writable:        false,
    restartRequired: false,
    secret:          false,
    group:           "Build-time",
  },
  {
    key:             "NEXT_PUBLIC_SASIS_ENABLED",
    description:     "Set true to show the VeKa card lookup UI. Baked at build time.",
    default:         "false",
    required:        false,
    writable:        false,
    restartRequired: false,
    secret:          false,
    group:           "Build-time",
  },
  {
    key:             "NEXT_PUBLIC_GLN_ENABLED",
    description:     "Set true to show the GLN lookup UI. Baked at build time.",
    default:         "false",
    required:        false,
    writable:        false,
    restartRequired: false,
    secret:          false,
    group:           "Build-time",
  },
  {
    key:             "NEXT_PUBLIC_LAB_ORG_ID",
    description:     "GLN or FHIR Organization ID of the laboratory used to filter the test catalog. Baked at build time — pass as Docker --build-arg.",
    default:         "7601009336904",
    required:        false,
    writable:        false,
    restartRequired: false,
    secret:          false,
    group:           "Build-time",
  },
  {
    key:             "NEXT_PUBLIC_LAB_NAME",
    description:     "Display name of the laboratory shown in the UI and on documents (e.g. ZLZ Zentrallabor AG). Baked at build time.",
    default:         "ZLZ Zentrallabor AG",
    required:        false,
    writable:        false,
    restartRequired: false,
    secret:          false,
    group:           "Build-time",
  },
  {
    key:             "NEXT_PUBLIC_ORDER_SERVICE_TYPES",
    description:
      "Comma-separated list of service types baked into the client bundle as the initial UI default. " +
      "The UI updates dynamically at runtime via GET /api/v1/config/service-types. " +
      "Only required if you need a different default before the API response arrives. " +
      "Baked at build time — pass as Docker --build-arg.",
    default:         "MIBI,ROUTINE,POC",
    required:        false,
    writable:        false,
    restartRequired: false,
    secret:          false,
    group:           "Build-time",
  },
] as const;

// ── Controller ────────────────────────────────────────────────────────────────

export class EnvController {
  private readonly envPath: string;

  constructor(cwd: string = process.cwd()) {
    this.envPath = path.join(cwd, ".env.local");
  }

  // ── GET /api/env/schema ────────────────────────────────────────────────────

  /**
   * Returns the complete catalog of all ENV vars the app supports.
   * Current values are included; secret values are masked as "••••••••".
   */
  getSchema(): EnvSchemaResponseDto {
    const entries = ENV_SCHEMA.map((entry) => {
      const rawValue = process.env[entry.key] ?? "";
      const currentValue = entry.secret && rawValue
        ? "••••••••"
        : rawValue;
      return { ...entry, currentValue };
    });
    return { entries };
  }

  // ── GET /api/env ────────────────────────────────────────────────────────────
  //
  // Reads from process.env — the authoritative source in all environments:
  //  - Vercel:     .env.local does not exist at runtime; vars come from the
  //                Vercel dashboard and are injected into process.env.
  //  - Docker:     docker-compose env vars override .env.local file values,
  //                so process.env always wins.
  //  - Local dev:  Next.js merges .env.local into process.env at startup.

  async get(): Promise<GetEnvResponseDto> {
    const vars = Object.entries(process.env)
      .filter(([key]) => isAllowed(key))
      .map(([key, value]) => ({ key, value: value ?? "" }));

    return { vars };
  }

  // ── POST /api/env ───────────────────────────────────────────────────────────

  async update(body: UpdateEnvRequestDto): Promise<UpdateEnvResponseDto> {
    // Guard: Vercel serverless functions run in a read-only filesystem.
    // Env vars must be managed via the Vercel dashboard instead.
    if (isVercel()) {
      return {
        ok: false,
        message:
          "In dieser Umgebung (Vercel) nicht verfügbar. " +
          "Umgebungsvariablen müssen über das Vercel-Dashboard verwaltet werden.",
        httpStatus: 405,
      };
    }

    // Validate: no empty keys
    const emptyKey = body.vars.find((v) => !v.key.trim());
    if (emptyKey !== undefined) {
      return {
        ok: false,
        message: "Ungültige Anfrage: leerer Variablenname.",
        httpStatus: 400,
      };
    }

    // Validate: only whitelisted keys may be written
    const forbidden = body.vars.find((v) => !isAllowed(v.key.trim()));
    if (forbidden !== undefined) {
      return {
        ok: false,
        message: `Nicht erlaubt: "${forbidden.key}" darf nicht geändert werden.`,
        httpStatus: 403,
      };
    }

    // Build update map from the incoming vars
    const incomingKeys = new Set(body.vars.map((v) => v.key.trim()));
    const updates = new Map<string, string | null>();

    for (const { key, value } of body.vars) {
      updates.set(key.trim(), value);
    }

    // Delete whitelisted keys that were present in the file but are now absent
    const content = await this.readFile();
    const existing = parseEnvFile(content);
    for (const key of existing.keys()) {
      if (isAllowed(key) && !incomingKeys.has(key)) {
        updates.set(key, null);
      }
    }

    const updated = applyEnvUpdates(content, updates);

    try {
      await fs.writeFile(this.envPath, updated, "utf8");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Fehler beim Schreiben der Datei: ${msg}`,
        httpStatus: 500,
      };
    }

    return {
      ok: true,
      message:
        "Gespeichert. Bitte starten Sie die Anwendung bzw. den Container neu, " +
        "damit die Änderungen wirksam werden.",
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async readFile(): Promise<string> {
    try {
      return await fs.readFile(this.envPath, "utf8");
    } catch {
      return "";
    }
  }
}

/** Production singleton. */
export const envController = new EnvController();
