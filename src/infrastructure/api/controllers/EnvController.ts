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
import type {
  GetEnvResponseDto,
  UpdateEnvRequestDto,
  UpdateEnvResponseDto,
  EnvSchemaResponseDto,
} from "../dto/EnvDto";

// ── Whitelist ─────────────────────────────────────────────────────────────────

/**
 * Explicit whitelist of server-side keys that may be read and written.
 * NEXT_PUBLIC_* keys are always allowed (checked dynamically).
 *
 * To expose a new variable:
 *  1. Add it here.
 *  2. Add the corresponding EnvConfig getter in infrastructure/config/EnvConfig.ts.
 *  3. Document it in the Environment Variables table in CLAUDE.md.
 */
const ALLOWED_SERVER_KEYS = new Set([
  "FHIR_BASE_URL",
  "LOG_LEVEL",
  "LOG_FILE",
  "ENABLE_TRACING",
  "TRACING_URL",
  "MONITORING_URL",
  "SASIS_API_BASE",
  "GLN_API_BASE",
  "ALLOW_LOCAL_AUTH",
  // DB configuration — DATABASE_URL is intentionally excluded (may contain passwords;
  // use GET /api/health/db for a masked URL instead).
  "DB_PROVIDER",
  // Orchestra HL7 proxy — path variables are optional (defaults built into EnvConfig)
  "ORCHESTRA_HL7_BASE",
  "ORCHESTRA_HL7_INBOUND_PATH",
  "ORCHESTRA_HL7_OUTBOUND_PATH",
  // Security
  "SESSION_IDLE_TIMEOUT_MINUTES",
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
    key:             "FHIR_BASE_URL",
    description:     "Base URL of the HAPI FHIR R4 server. Used by all FHIR proxy routes.",
    default:         "http://localhost:8080/fhir",
    required:        true,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "FHIR",
  },
  // ── Authentication ─────────────────────────────────────────────────────────
  {
    key:             "AUTH_SECRET",
    description:     "HMAC-SHA256 signing secret for session cookies. Must be ≥32 chars in production.",
    default:         "dev-secret-change-me",
    required:        true,
    writable:        false,
    restartRequired: true,
    secret:          true,
    group:           "Authentication",
  },
  {
    key:             "ALLOW_LOCAL_AUTH",
    description:     "Set true to allow the unsigned localSession cookie (browser-only auth fallback).",
    default:         "false",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Authentication",
  },
  {
    key:             "ORCHESTRA_JWT_SECRET",
    description:     "Shared HS256 secret for /api/launch JWT validation from Orchestra. Generate: openssl rand -hex 32",
    default:         "",
    required:        false,
    writable:        false,
    restartRequired: true,
    secret:          true,
    group:           "Authentication",
  },
  // ── Logging ────────────────────────────────────────────────────────────────
  {
    key:             "LOG_LEVEL",
    description:     "Minimum log level. Accepted values: debug | info | warn | error | silent",
    default:         "info",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Logging",
  },
  {
    key:             "LOG_FILE",
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
    key:             "ENABLE_TRACING",
    description:     "Set true to activate OpenTelemetry distributed tracing. Requires TRACING_URL.",
    default:         "false",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Observability",
  },
  {
    key:             "TRACING_URL",
    description:     "OTLP/HTTP collector base URL for distributed tracing (e.g. http://jaeger:4318 or http://tempo:4318). Active only when ENABLE_TRACING=true.",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Observability",
  },
  {
    key:             "MONITORING_URL",
    description:     "Monitoring dashboard base URL displayed in the Settings page (e.g. http://grafana:3000). Display-only link.",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Observability",
  },
  {
    key:             "METRICS_TOKEN",
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
    key:             "SASIS_API_BASE",
    description:     "SASIS/OFAC VeKa card lookup API base URL (via Orchestra middleware). Empty = feature disabled.",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "External APIs",
  },
  {
    key:             "GLN_API_BASE",
    description:     "GLN/Refdata partner lookup API base URL (via Orchestra middleware).",
    default:         "http://orchestra:8019/middleware/gln/api/versionVal/refdata/partner/",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "External APIs",
  },
  // ── Orchestra / HL7 Proxy ─────────────────────────────────────────────────
  {
    key:             "ORCHESTRA_HL7_BASE",
    description:     "Base URL of the Orchestra HL7 API (e.g. http://orchestra:8019). Empty = HL7 proxy disabled.",
    default:         "",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Orchestra",
  },
  {
    key:             "ORCHESTRA_HL7_INBOUND_PATH",
    description:     "Orchestra path for receiving inbound HL7 messages from the Edge agent.",
    default:         "/api/v1/in/hl7",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Orchestra",
  },
  {
    key:             "ORCHESTRA_HL7_OUTBOUND_PATH",
    description:     "Orchestra path for retrieving outbound HL7 result messages (ORU).",
    default:         "/api/v1/out/hl7",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Orchestra",
  },
  // ── Security ──────────────────────────────────────────────────────────────
  {
    key:             "SESSION_IDLE_TIMEOUT_MINUTES",
    description:     "Automatische Abmeldung nach Inaktivität (Minuten). 0 = deaktiviert. Empfehlung für Medizinsoftware: 15–30 Minuten.",
    default:         "30",
    required:        false,
    writable:        true,
    restartRequired: true,
    secret:          false,
    group:           "Security",
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
    description:     "FHIR Organization ID of the laboratory used to filter the test catalog. Baked at build time — pass as Docker --build-arg.",
    default:         "zlz",
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
