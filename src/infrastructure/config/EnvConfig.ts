/**
 * Server-side environment configuration.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  Naming convention:  <APP_NAME>_<SERVICE>__<KEY>                        ║
 * ║                                                                          ║
 * ║  APP_NAME  — set once via APP_NAME env var (default: "ORDERENTRY").     ║
 * ║              Changing APP_NAME renames ALL variables automatically.     ║
 * ║  SERVICE   — logical domain (FHIR, AUTH, LOG, ORCHESTRA, …)            ║
 * ║  __        — double-underscore separates SERVICE from KEY               ║
 * ║  KEY       — specific setting, underscores within                       ║
 * ║                                                                          ║
 * ║  Example:  ORDERENTRY_FHIR__BASE_URL                                    ║
 * ║            ORDERENTRY_AUTH__SECRET                                       ║
 * ║            ORDERENTRY_LOG__LEVEL                                         ║
 * ║                                                                          ║
 * ║  Exceptions (framework constraints — cannot be renamed):                ║
 * ║    NEXT_PUBLIC_*  — Next.js bakes these at build time                   ║
 * ║    DATABASE_URL   — Prisma reads this name directly                     ║
 * ║    NODE_ENV       — Node.js runtime convention                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ⚠️  DO NOT import this file in client components — server vars are NOT
 *     exposed to the browser. Use AppConfig (shared/config/AppConfig.ts)
 *     for NEXT_PUBLIC_* variables instead.
 *
 * Rules:
 *  - All process.env reads happen here and nowhere else (server side).
 *  - Every variable has a documented default so Docker and local dev behave
 *    identically when the variable is not set.
 *  - Booleans are parsed with a shared helper so "true"/"1"/"yes" all work.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

function str(value: string | undefined, fallback: string): string {
  return (value ?? "").trim() || fallback;
}

function num(value: string | undefined, fallback: number): number {
  const parsed = parseInt((value ?? "").trim(), 10);
  return isNaN(parsed) ? fallback : parsed;
}

// ── Dynamic prefix ────────────────────────────────────────────────────────────

/**
 * App prefix — derived from APP_NAME at process startup.
 * All environment variable names are constructed from this prefix.
 * Changing APP_NAME= in .env.local renames every variable at once.
 *
 * Default: "ORDERENTRY"
 */
export const APP_PREFIX = (process.env.APP_NAME ?? "ORDERENTRY").toUpperCase();

/**
 * Builds the full environment variable name for a given service key.
 *
 * @example
 *   envKey("FHIR__BASE_URL")  →  "ORDERENTRY_FHIR__BASE_URL"
 *   envKey("AUTH__SECRET")    →  "ORDERENTRY_AUTH__SECRET"
 *
 * Export is intentional — EnvController imports this to build ALLOWED_SERVER_KEYS
 * and ENV_SCHEMA keys consistently with the same prefix.
 */
export function envKey(serviceKey: string): string {
  return `${APP_PREFIX}_${serviceKey}`;
}

/** Reads one namespaced environment variable. */
function env(serviceKey: string): string | undefined {
  return process.env[envKey(serviceKey)];
}

// ── Config ────────────────────────────────────────────────────────────────────

export const EnvConfig = {
  /** Active app prefix (value of APP_NAME env var). Default: "ORDERENTRY". */
  appPrefix: APP_PREFIX,

  // ── FHIR ───────────────────────────────────────────────────────────────────
  /** Base URL of the HAPI FHIR R4 server. */
  fhirBaseUrl: str(env("FHIR__BASE_URL"), "http://localhost:8080/fhir"),

  /**
   * FHIR identifier system URIs for Swiss and global registries.
   * All values can be overridden via environment variables.
   * Defaults are the current official system URIs (correct as of 2025).
   */
  fhirSystems: {
    /** GS1 Global Location Number — https://www.gs1.org/standards/id-keys/gln */
    gln:      str(env("FHIR__SYSTEM_GLN"),      "https://www.gs1.org/gln"),
    /** Swiss AHV/AVS Social Security Number */
    ahv:      str(env("FHIR__SYSTEM_AHV"),      "urn:oid:2.16.756.5.32"),
    /** Swiss VeKa insurance card number */
    veka:     str(env("FHIR__SYSTEM_VEKA"),     "urn:oid:2.16.756.5.30.1.123.100.1.1"),
    /** santésuisse Zahlstellenregister (ZSR) */
    zsr:      str(env("FHIR__SYSTEM_ZSR"),      "urn:oid:2.16.756.5.30.1.123.100.2.1.1"),
    /** Swiss Unternehmens-Identifikation (UID / CHE-number) */
    uid:      str(env("FHIR__SYSTEM_UID"),      "urn:oid:2.16.756.5.35"),
    /** Swiss Betriebseinheitsnummer BFS (BUR) */
    bur:      str(env("FHIR__SYSTEM_BUR"),      "urn:oid:2.16.756.5.45"),
    /** ZetLab service category system — used in ActivityDefinition.topic */
    category: str(env("FHIR__SYSTEM_CATEGORY"), "https://www.zetlab.ch/fhir/category"),
  },

  // ── FHIR outbound auth ─────────────────────────────────────────────────────
  // Controls how FhirClient authenticates outbound requests to HAPI FHIR.
  // Default: "none" (HAPI runs on a trusted internal Docker network).

  /** Auth type for outbound FHIR requests: none | bearer | basic | apiKey | oauth2 | digest */
  fhirAuthType:           str(env("FHIR__AUTH_TYPE"),             "none"),
  /** Bearer token — used when FHIR_AUTH_TYPE=bearer */
  fhirAuthToken:          str(env("FHIR__AUTH_TOKEN"),            ""),
  /** Username — used when FHIR_AUTH_TYPE=basic or digest */
  fhirAuthUser:           str(env("FHIR__AUTH_USER"),             ""),
  /** Password — used when FHIR_AUTH_TYPE=basic or digest */
  fhirAuthPassword:       str(env("FHIR__AUTH_PASSWORD"),         ""),
  /** API key header/param name — used when FHIR_AUTH_TYPE=apiKey */
  fhirAuthApiKeyName:     str(env("FHIR__AUTH_API_KEY_NAME"),     ""),
  /** API key value — used when FHIR_AUTH_TYPE=apiKey */
  fhirAuthApiKeyValue:    str(env("FHIR__AUTH_API_KEY_VALUE"),    ""),
  /** API key location: "header" or "query" — used when FHIR_AUTH_TYPE=apiKey */
  fhirAuthApiKeyLocation: str(env("FHIR__AUTH_API_KEY_LOCATION"), "header") as "header" | "query",
  /** OAuth2 client ID — used when FHIR_AUTH_TYPE=oauth2 */
  fhirAuthClientId:       str(env("FHIR__AUTH_CLIENT_ID"),        ""),
  /** OAuth2 client secret — used when FHIR_AUTH_TYPE=oauth2 */
  fhirAuthClientSecret:   str(env("FHIR__AUTH_CLIENT_SECRET"),    ""),
  /** OAuth2 token endpoint URL — used when FHIR_AUTH_TYPE=oauth2 */
  fhirAuthTokenUrl:       str(env("FHIR__AUTH_TOKEN_URL"),        ""),
  /** OAuth2 scopes, space-separated — used when FHIR_AUTH_TYPE=oauth2. Optional. */
  fhirAuthScopes:         str(env("FHIR__AUTH_SCOPES"),           ""),

  // ── Auth ───────────────────────────────────────────────────────────────────
  /** HMAC secret used to sign session cookies. Must be ≥32 chars in production. */
  authSecret: str(env("AUTH__SECRET"), "dev-secret-change-me"),

  /** Allow the unsigned localSession cookie (for browser-only auth fallback). */
  allowLocalAuth: bool(env("AUTH__ALLOW_LOCAL")),

  /**
   * Idle session timeout in minutes. 0 = disabled.
   * Medical software recommendation: 15–30 minutes.
   */
  sessionIdleTimeoutMinutes: num(env("AUTH__SESSION_IDLE_TIMEOUT"), 30),

  // ── Orchestra ──────────────────────────────────────────────────────────────
  /**
   * Shared HS256 secret for /api/launch JWT validation from Orchestra.
   * Must not be added to ALLOWED_SERVER_KEYS — matches BLOCKED_PATTERNS (SECRET).
   */
  orchestraJwtSecret: str(env("ORCHESTRA__JWT_SECRET"), ""),

  /** Base URL of the Orchestra HL7 HTTP API. Empty = disabled. */
  orchestraHl7Base: str(env("ORCHESTRA__HL7_BASE"), ""),

  /** Path on Orchestra that accepts inbound HL7 messages via POST. */
  orchestraHl7InboundPath: str(env("ORCHESTRA__HL7_INBOUND_PATH"), "/api/v1/in/hl7"),

  /** Path on Orchestra that exposes outbound HL7 results via GET. */
  orchestraHl7OutboundPath: str(env("ORCHESTRA__HL7_OUTBOUND_PATH"), "/api/v1/out/hl7"),

  /** Base URL of the Orchestra order number API (POST). Empty = pool-only mode. */
  orchestraOrderApiUrl: str(env("ORCHESTRA__ORDER_API_URL"), ""),

  /** Timeout in ms for Orchestra order number requests. */
  orchestraOrderTimeoutMs: num(env("ORCHESTRA__ORDER_TIMEOUT_MS"), 3000),

  // ── Database ───────────────────────────────────────────────────────────────
  // DATABASE_URL is NOT read here — Prisma reads it directly by that exact name.
  // DB_PROVIDER is the only switchable DB setting exposed through EnvConfig.

  /** Database engine: sqlite (default) | postgresql | sqlserver */
  dbProvider: str(env("DB__PROVIDER"), "sqlite"),

  // ── Logging ────────────────────────────────────────────────────────────────
  /** Minimum log level: debug | info | warn | error | silent */
  logLevel: str(env("LOG__LEVEL"), "info"),

  /** Absolute path to append structured JSON log lines. Empty = file logging disabled. */
  logFile: str(env("LOG__FILE"), ""),

  // ── Observability ──────────────────────────────────────────────────────────
  /** Set true to activate OpenTelemetry distributed tracing. Requires tracingUrl. */
  enableTracing: bool(env("TRACING__ENABLED")),

  /** OTLP/HTTP collector base URL. Active only when enableTracing=true. */
  tracingUrl: str(env("TRACING__URL"), ""),

  /** Display label for the tracing system (e.g. "Jaeger", "Tempo"). */
  tracingLabel: str(env("TRACING__LABEL"), ""),

  /** Monitoring dashboard URL shown in Settings (display-only link). */
  monitoringUrl: str(env("MONITORING__URL"), ""),

  /** Display label for the monitoring system (e.g. "Grafana", "Prometheus"). */
  monitoringLabel: str(env("MONITORING__LABEL"), ""),

  /**
   * Optional static Bearer token for the Prometheus scraper (GET /api/metrics).
   * Never exposed via env editor — matches BLOCKED_PATTERNS (TOKEN).
   */
  metricsToken: str(env("METRICS__TOKEN"), ""),

  // ── External APIs ──────────────────────────────────────────────────────────
  /** SASIS base URL for VeKa card lookups via Orchestra. Empty = disabled. */
  sasisApiBase: str(env("SASIS__API_BASE"), ""),

  /**
   * RefData SOAP endpoint for GLN partner lookups.
   * Default: production RefData web service.
   * Override via env var for staging or mock testing.
   */
  refdataSoapUrl: str(
    env("REFDATA__SOAP_URL"),
    "https://refdatabase.refdata.ch/Service/Partner.asmx",
  ),

  // ── Outbound mail (nodemailer) ─────────────────────────────────────────────
  /** Mail provider: smtp | gmail | smtp_oauth2 | google_workspace_relay. Empty = disabled. */
  mailProvider:          str(env("MAIL__PROVIDER"),           ""),
  /** Auth method: APP_PASSWORD | OAUTH2 | NONE. Default: APP_PASSWORD. */
  mailAuthType:          str(env("MAIL__AUTH_TYPE"),          "APP_PASSWORD"),
  /** SMTP server hostname. */
  mailHost:              str(env("MAIL__HOST"),               ""),
  /** SMTP port number as string (default: 587). */
  mailPort:              str(env("MAIL__PORT"),               "587"),
  /** Use TLS on connect (true = implicit TLS port 465; false = STARTTLS port 587). */
  mailSecure:            bool(env("MAIL__SECURE")),
  /** Sender email address / SMTP username. */
  mailUser:              str(env("MAIL__USER"),               ""),
  /** SMTP password or App Password — secret, never returned by API. */
  mailPassword:          str(env("MAIL__PASSWORD"),           ""),
  /** Default From address, e.g. "OrderEntry <noreply@example.com>". */
  mailFrom:              str(env("MAIL__FROM"),               ""),
  /** Reply-To / alias address (optional). */
  mailAlias:             str(env("MAIL__ALIAS"),              ""),
  /** OAuth2 client ID for mail. */
  mailOauthClientId:     str(env("MAIL__OAUTH_CLIENT_ID"),    ""),
  /** OAuth2 client secret — secret, never returned by API. */
  mailOauthClientSecret: str(env("MAIL__OAUTH_CLIENT_SECRET"), ""),
  /** OAuth2 long-lived refresh token — secret, never returned by API. */
  mailOauthRefreshToken: str(env("MAIL__OAUTH_REFRESH_TOKEN"), ""),
  /** Google Workspace domain for relay (optional). */
  mailDomain:            str(env("MAIL__DOMAIN"),             ""),

  // ── Deep Linking (KIS/PIS → OrderEntry) ───────────────────────────────────
  /** Set true to activate the GET /api/deeplink/order-entry endpoint. */
  deepLinkEnabled:        bool(env("DEEPLINK__ENABLED")),
  /** Auth strategy: "jwt" (default) or "hmac". */
  deepLinkAuthType:       str(env("DEEPLINK__AUTH_TYPE"),             "jwt"),
  /** HS256 secret for JWT deep-link tokens — never exposed via env editor. */
  deepLinkJwtSecret:      str(env("DEEPLINK__JWT_SECRET"),            ""),
  /** HMAC-SHA256 secret for canonical URL deep-link tokens — never exposed. */
  deepLinkHmacSecret:     str(env("DEEPLINK__HMAC_SECRET"),           ""),
  /** Maximum token age in seconds (default: 300 = 5 minutes). */
  deepLinkTokenMaxAge:    str(env("DEEPLINK__TOKEN_MAX_AGE_SECONDS"), "300"),
  /** Comma-separated allowed source system identifiers. Empty = accept all. */
  deepLinkAllowedSystems: str(env("DEEPLINK__ALLOWED_SYSTEMS"),       ""),

  // ── Order Number Engine ────────────────────────────────────────────────────
  /** MIBI order number prefix (default: "MI"). */
  orderMiPrefix: str(env("ORDER__MI_PREFIX"), "MI"),
  /** MIBI order number start digit after prefix (default: "4"). */
  orderMiStart:  str(env("ORDER__MI_START"),  "4"),
  /** MIBI order number total length including prefix (default: 10). */
  orderMiLength: num(env("ORDER__MI_LENGTH"), 10),
  /** Routine order number total numeric length (default: 10). */
  orderRoutineLength: num(env("ORDER__ROUTINE_LENGTH"), 10),
  /** POC order number prefix (default: "PO"). */
  orderPocPrefix: str(env("ORDER__POC_PREFIX"), "PO"),
  /** POC order number total length including prefix (default: 7). */
  orderPocLength: num(env("ORDER__POC_LENGTH"), 7),

  /**
   * Comma-separated list of active order service types.
   * Drives pool queries, strategy selection, and HL7 mapping on the server.
   * Example: ORDERENTRY_ORDER__SERVICE_TYPES=MIBI,ROUTINE,POC,CHEMO
   */
  orderServiceTypes: (env("ORDER__SERVICE_TYPES") ?? "MIBI,ROUTINE,POC")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // ── Access Control ────────────────────────────────────────────────────────
  /**
   * Comma-separated FHIR Organization IDs that are considered internal (ZLZ/ZetLab).
   * Practitioners with a PractitionerRole in one of these orgs get Level A (full) access.
   * All other practitioners get Level B (org) or Level C (own) access.
   * Example: ORDERENTRY_LAB__INTERNAL_ORG_IDS=zlz,zetlab,zlz-notfall
   */
  labInternalOrgIds: (env("LAB__INTERNAL_ORG_IDS") ?? "zlz,zetlab,zlz-notfall")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // ── SNOMED Codes ──────────────────────────────────────────────────────────

  /** SNOMED codes for internal lab staff → Level A (full access). */
  snomedRoleInternal: (env("SNOMED__ROLE_INTERNAL") ?? "159418007,159011000")
    .split(",").map((s) => s.trim()).filter(Boolean),

  /** SNOMED codes for external org-admins → Level B (org filter). */
  snomedRoleOrgAdmin: (env("SNOMED__ROLE_ORG_ADMIN") ?? "224608005,394572006")
    .split(",").map((s) => s.trim()).filter(Boolean),

  /** SNOMED codes for external physicians → Level C (own filter). */
  snomedRolePhysician: (env("SNOMED__ROLE_PHYSICIAN") ?? "309343006,59058001,106289002")
    .split(",").map((s) => s.trim()).filter(Boolean),

  /** SNOMED code for clinical laboratory organization type. */
  snomedOrgLaboratory: str(env("SNOMED__ORG_LABORATORY"), "708175003"),

  /** SNOMED code for hospital organization type. */
  snomedOrgHospital: str(env("SNOMED__ORG_HOSPITAL"), "22232009"),

  /** SNOMED code for outpatient clinic organization type. */
  snomedOrgOutpatient: str(env("SNOMED__ORG_OUTPATIENT"), "33022008"),

  /** SNOMED code for healthcare holding/group organization type. */
  snomedOrgHolding: str(env("SNOMED__ORG_HOLDING"), "224891009"),

  // ── Labor / Organisation ──────────────────────────────────────────────────
  /**
   * FHIR Resource-ID der Labororganisation.
   * Wird serverseitig für FHIR-Referenzen (Organization/...) verwendet.
   * Format: FHIR-valide Zeichen [A-Za-z0-9\-\.]{1,64}
   * Empfehlung: <Kürzel>-<GLN>  z.B. ZLZ-7601009336904
   * Default entspricht NEXT_PUBLIC_LAB_ORG_ID falls nicht gesetzt.
   */
  labOrgId: str(
    env("LAB__ORG_ID") ?? process.env.NEXT_PUBLIC_LAB_ORG_ID,
    "ZLZ-7601009336904",
  ),

  /**
   * Anzeigename des Labors — für FHIR Organization.name,
   * Begleitscheine, HL7-Nachrichten und Admin-UI.
   * Default entspricht NEXT_PUBLIC_LAB_NAME falls nicht gesetzt.
   */
  labName: str(
    env("LAB__NAME") ?? process.env.NEXT_PUBLIC_LAB_NAME,
    "ZLZ Zentrallabor AG",
  ),

  // ── Debug Mode ─────────────────────────────────────────────────────────────
  /**
   * Enable the admin-only debug panel showing FHIR request/response traces.
   * Never enable in production — exposes internal API details.
   */
  debugEnabled: bool(env("DEBUG__ENABLED")),

  // ── FHIR Seed ──────────────────────────────────────────────────────────────
  /**
   * Enable FHIR seed bootstrap on container startup.
   * When true, fhir-seed.mjs loads masterdata.json into the FHIR server
   * on first start (idempotent — skipped if already at the expected version).
   * Default: true.
   */
  fhirSeedEnabled: bool(env("FHIR__SEED_ENABLED"), true),

  /**
   * Also load demo-data.json on startup (Patients, ServiceRequests, DiagnosticReports).
   * Only effective when fhirSeedEnabled=true.
   * Never enable in production.
   * Default: false.
   */
  fhirSeedDemo: bool(env("FHIR__SEED_DEMO"), false),

  // ── Number Pool ────────────────────────────────────────────────────────────
  /** Pool INFO email threshold (default: 30). */
  poolInfoThreshold:     num(env("POOL__INFO_THRESHOLD"),    30),
  /** Pool WARN email threshold (default: 15). */
  poolWarnThreshold:     num(env("POOL__WARN_THRESHOLD"),    15),
  /** Pool ERROR email threshold (default: 5). */
  poolErrorThreshold:    num(env("POOL__ERROR_THRESHOLD"),   5),
  /** Default notification email for pool alerts. */
  poolNotificationEmail: str(env("POOL__NOTIFICATION_EMAIL"), ""),
} as const;

export type EnvConfigType = typeof EnvConfig;
