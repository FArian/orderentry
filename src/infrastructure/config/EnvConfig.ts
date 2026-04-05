/**
 * Server-side environment configuration.
 *
 * ⚠️  DO NOT import this file in client components or pages that render
 *     on the browser — process.env server vars are NOT exposed to the client.
 *
 * Rules:
 *  - All process.env reads happen here and nowhere else (server side).
 *  - Every variable has a documented default so Docker and local dev behave
 *    identically when the variable is not set.
 *  - Booleans are parsed with a shared helper so "true"/"1"/"yes" all work.
 */

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

export const EnvConfig = {
  // ── FHIR ─────────────────────────────────────────────────────────────────
  /** Base URL of the HAPI FHIR R4 server. */
  fhirBaseUrl: str(
    process.env.FHIR_BASE_URL,
    "http://localhost:8080/fhir",
  ),

  /**
   * FHIR identifier system URIs for Swiss and global registries.
   * All values can be overridden via environment variables.
   * Defaults are the current official system URIs — correct as of 2025.
   */
  fhirSystems: {
    /** GS1 Global Location Number — https://www.gs1.org/standards/id-keys/gln */
    gln:  str(process.env.FHIR_SYSTEM_GLN,  "https://www.gs1.org/gln"),
    /** Swiss AHV/AVS Social Security Number */
    ahv:  str(process.env.FHIR_SYSTEM_AHV,  "urn:oid:2.16.756.5.32"),
    /** Swiss VeKa insurance card number */
    veka: str(process.env.FHIR_SYSTEM_VEKA, "urn:oid:2.16.756.5.30.1.123.100.1.1"),
    /** santésuisse Zahlstellenregister (ZSR) */
    zsr:  str(process.env.FHIR_SYSTEM_ZSR,  "urn:oid:2.16.756.5.30.1.123.100.2.1.1"),
    /** Swiss Unternehmens-Identifikation (UID / CHE-number) */
    uid:  str(process.env.FHIR_SYSTEM_UID,  "urn:oid:2.16.756.5.35"),
    /** Swiss Betriebseinheitsnummer BFS (BUR) */
    bur:  str(process.env.FHIR_SYSTEM_BUR,  "urn:oid:2.16.756.5.45"),
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  /** HMAC secret used to sign session cookies. Must be ≥32 chars in production. */
  authSecret: str(process.env.AUTH_SECRET, "dev-secret-change-me"),

  /** Allow the unsigned localSession cookie (for read-only filesystem deploys). */
  allowLocalAuth: bool(process.env.ALLOW_LOCAL_AUTH),

  // ── Logging ───────────────────────────────────────────────────────────────
  /** Minimum log level. debug < info < warn < error < silent. */
  logLevel: str(process.env.LOG_LEVEL, "info"),

  /** Absolute path to append log lines to. Empty string = disabled. */
  logFile: str(process.env.LOG_FILE, ""),

  // ── External APIs ─────────────────────────────────────────────────────────
  /** SASIS base URL for VeKa card lookups. Empty string = disabled. */
  sasísApiBase: str(process.env.SASIS_API_BASE, ""),

  /** GLN registry base URL (Orchestra middleware). */
  glnApiBase: str(
    process.env.GLN_API_BASE,
    "http://orchestra:8019/middleware/gln/api/versionVal/refdata/partner/",
  ),

  // ── Observability (integration-ready placeholders) ────────────────────────
  /**
   * Set ENABLE_TRACING=true to activate distributed tracing.
   * A traceId will be included in every structured log line.
   * Currently a placeholder — wire to an OpenTelemetry SDK when ready.
   */
  enableTracing: bool(process.env.ENABLE_TRACING),

  /**
   * Tracing collector URL (e.g. http://zipkin:9411 or OTLP endpoint).
   * Only used when ENABLE_TRACING=true.
   */
  tracingUrl: str(process.env.TRACING_URL, ""),

  /**
   * Monitoring/dashboard base URL (e.g. Grafana instance).
   * Displayed in the Settings page as a quick-access link.
   */
  monitoringUrl: str(process.env.MONITORING_URL, ""),

  /**
   * Display label for the monitoring system (e.g. "Grafana", "Prometheus").
   * Empty = UI falls back to the default i18n label "Monitoring".
   */
  monitoringLabel: str(process.env.MONITORING_LABEL, ""),

  /**
   * Display label for the tracing system (e.g. "Jaeger", "Zipkin", "Tempo").
   * Empty = UI falls back to the default i18n label "Tracing".
   */
  tracingLabel: str(process.env.TRACING_LABEL, ""),

  /**
   * Optional static Bearer token for the Prometheus scraper (GET /api/metrics).
   * When set, only requests with  Authorization: Bearer <token>  are accepted.
   * When not set, standard admin session / JWT / PAT auth is used instead.
   * Never expose via the env editor — matches BLOCKED_PATTERNS (TOKEN).
   */
  metricsToken: str(process.env.METRICS_TOKEN, ""),

  // ── FHIR outbound auth ────────────────────────────────────────────────────
  // Controls how FhirClient authenticates outbound requests to HAPI FHIR.
  // Default: "none" (HAPI runs on a trusted internal Docker network).

  /** Auth type for outbound FHIR requests. One of: none, bearer, basic, apiKey, oauth2, digest. */
  fhirAuthType: str(process.env.FHIR_AUTH_TYPE, "none"),

  /** Bearer token — used when FHIR_AUTH_TYPE=bearer. */
  fhirAuthToken: str(process.env.FHIR_AUTH_TOKEN, ""),

  /** Username — used when FHIR_AUTH_TYPE=basic or digest. */
  fhirAuthUser: str(process.env.FHIR_AUTH_USER, ""),

  /** Password — used when FHIR_AUTH_TYPE=basic or digest. */
  fhirAuthPassword: str(process.env.FHIR_AUTH_PASSWORD, ""),

  /** API key header/param name — used when FHIR_AUTH_TYPE=apiKey. */
  fhirAuthApiKeyName: str(process.env.FHIR_AUTH_API_KEY_NAME, ""),

  /** API key value — used when FHIR_AUTH_TYPE=apiKey. */
  fhirAuthApiKeyValue: str(process.env.FHIR_AUTH_API_KEY_VALUE, ""),

  /** API key location: "header" or "query" — used when FHIR_AUTH_TYPE=apiKey. */
  fhirAuthApiKeyLocation: str(process.env.FHIR_AUTH_API_KEY_LOCATION, "header") as "header" | "query",

  /** OAuth2 client ID — used when FHIR_AUTH_TYPE=oauth2. */
  fhirAuthClientId: str(process.env.FHIR_AUTH_CLIENT_ID, ""),

  /** OAuth2 client secret — used when FHIR_AUTH_TYPE=oauth2. */
  fhirAuthClientSecret: str(process.env.FHIR_AUTH_CLIENT_SECRET, ""),

  /** OAuth2 token endpoint URL — used when FHIR_AUTH_TYPE=oauth2. */
  fhirAuthTokenUrl: str(process.env.FHIR_AUTH_TOKEN_URL, ""),

  /** OAuth2 scopes, space-separated — used when FHIR_AUTH_TYPE=oauth2. Optional. */
  fhirAuthScopes: str(process.env.FHIR_AUTH_SCOPES, ""),

  // ── Outbound mail (nodemailer) ────────────────────────────────────────────
  // Controls how OrderEntry sends emails (notifications, test emails, etc.)
  // Set MAIL_PROVIDER to enable; leave unset to disable mail entirely.

  /** Mail provider. One of: smtp | gmail | smtp_oauth2 | google_workspace_relay. Empty = disabled. */
  mailProvider: str(process.env.MAIL_PROVIDER, ""),

  /** Auth method. One of: APP_PASSWORD | OAUTH2 | NONE. Default: APP_PASSWORD. */
  mailAuthType: str(process.env.MAIL_AUTH_TYPE, "APP_PASSWORD"),

  /** SMTP server hostname (required for smtp, smtp_oauth2, google_workspace_relay). */
  mailHost: str(process.env.MAIL_HOST, ""),

  /** SMTP port number as string (default: 587). */
  mailPort: str(process.env.MAIL_PORT, "587"),

  /** Use TLS on connect (true = implicit TLS port 465; false = STARTTLS port 587). */
  mailSecure: bool(process.env.MAIL_SECURE),

  /** Sender email address / username. */
  mailUser: str(process.env.MAIL_USER, ""),

  /** SMTP password or Gmail App Password — secret, never returned by API. */
  mailPassword: str(process.env.MAIL_PASSWORD, ""),

  /** Default From address, e.g. "OrderEntry <noreply@example.com>". */
  mailFrom: str(process.env.MAIL_FROM, ""),

  /** Reply-To / alias address (optional). */
  mailAlias: str(process.env.MAIL_ALIAS, ""),

  /** OAuth2 client ID — used when MAIL_AUTH_TYPE=OAUTH2. */
  mailOauthClientId: str(process.env.MAIL_OAUTH_CLIENT_ID, ""),

  /** OAuth2 client secret — secret, never returned by API. */
  mailOauthClientSecret: str(process.env.MAIL_OAUTH_CLIENT_SECRET, ""),

  /** OAuth2 long-lived refresh token — secret, never returned by API. */
  mailOauthRefreshToken: str(process.env.MAIL_OAUTH_REFRESH_TOKEN, ""),

  /** Google Workspace domain for relay (optional, e.g. "example.com"). */
  mailDomain: str(process.env.MAIL_DOMAIN, ""),

  // ── Deep linking (KIS/PIS → OrderEntry) ──────────────────────────────────────
  // Allows external hospital information systems to deep-link directly into
  // the order-entry workflow via a signed token (JWT or HMAC-SHA256).

  /** Set true to activate the GET /api/deeplink/order-entry endpoint. */
  deepLinkEnabled: bool(process.env.DEEPLINK_ENABLED),

  /** Auth strategy for deep-link tokens: "jwt" (default) or "hmac". */
  deepLinkAuthType: str(process.env.DEEPLINK_AUTH_TYPE, "jwt"),

  /**
   * HS256 secret used by external systems to sign JWT deep-link tokens.
   * Must be ≥32 chars. Separate from AUTH_SECRET.
   * Never exposed via env editor (matches BLOCKED_PATTERNS: SECRET).
   */
  deepLinkJwtSecret: str(process.env.DEEPLINK_JWT_SECRET, ""),

  /**
   * HMAC-SHA256 secret used by external systems to sign canonical deep-link URLs.
   * Only used when DEEPLINK_AUTH_TYPE=hmac.
   * Never exposed via env editor (matches BLOCKED_PATTERNS: SECRET).
   */
  deepLinkHmacSecret: str(process.env.DEEPLINK_HMAC_SECRET, ""),

  /** Maximum age of deep-link tokens in seconds (default: 300 = 5 minutes). */
  deepLinkTokenMaxAge: str(process.env.DEEPLINK_TOKEN_MAX_AGE_SECONDS, "300"),

  /** Comma-separated list of allowed source system identifiers. Empty = accept all. */
  deepLinkAllowedSystems: str(process.env.DEEPLINK_ALLOWED_SYSTEMS, ""),

  // ── Orchestra HL7 proxy ───────────────────────────────────────────────────
  // Used by POST /api/v1/proxy/hl7/inbound and GET /api/v1/proxy/hl7/outbound.
  // OrderEntry does NOT parse HL7 — it is a pure HTTP proxy here.

  /** Base URL of the Orchestra HL7 HTTP API (e.g. http://orchestra:8019). Empty = disabled. */
  orchestraHl7Base: str(process.env.ORCHESTRA_HL7_BASE, ""),

  /** Path on Orchestra that accepts inbound HL7 messages via POST. */
  orchestraHl7InboundPath: str(process.env.ORCHESTRA_HL7_INBOUND_PATH, "/api/v1/in/hl7"),

  /** Path on Orchestra that exposes outbound HL7 results via GET. */
  orchestraHl7OutboundPath: str(process.env.ORCHESTRA_HL7_OUTBOUND_PATH, "/api/v1/out/hl7"),

  // ── Order Number Engine ───────────────────────────────────────────────────
  /** Base URL of the Orchestra order number API (POST). Empty = disabled (pool only). */
  orchestraOrderApiUrl: str(process.env.ORCHESTRA_ORDER_API_URL, ""),

  /** Timeout in ms for Orchestra order number requests. */
  orchestraOrderTimeoutMs: num(process.env.ORCHESTRA_ORDER_TIMEOUT_MS, 3000),

  /** MIBI order number prefix (default: "MI"). */
  orderMiPrefix: str(process.env.ORDER_MI_PREFIX, "MI"),

  /** MIBI order number start digit after prefix (default: "4"). */
  orderMiStart: str(process.env.ORDER_MI_START, "4"),

  /** MIBI order number total length including prefix (default: 10). */
  orderMiLength: num(process.env.ORDER_MI_LENGTH, 10),

  /** Routine order number total numeric length (default: 10). */
  orderRoutineLength: num(process.env.ORDER_ROUTINE_LENGTH, 10),

  /** POC order number prefix (default: "PO"). */
  orderPocPrefix: str(process.env.ORDER_POC_PREFIX, "PO"),

  /** POC order number total length including prefix (default: 7). */
  orderPocLength: num(process.env.ORDER_POC_LENGTH, 7),

  /** Pool INFO email threshold — send info alert when available ≤ this (default: 30). */
  poolInfoThreshold: num(process.env.POOL_INFO_THRESHOLD, 30),

  /** Pool WARN email threshold — send warn alert when available ≤ this (default: 15). */
  poolWarnThreshold: num(process.env.POOL_WARN_THRESHOLD, 15),

  /** Pool ERROR email threshold — send error alert when available ≤ this (default: 5). */
  poolErrorThreshold: num(process.env.POOL_ERROR_THRESHOLD, 5),

  /** Default notification email for pool alerts. Can be overridden in Admin UI. */
  poolNotificationEmail: str(process.env.POOL_NOTIFICATION_EMAIL, ""),

  // ── Security ──────────────────────────────────────────────────────────────
  /**
   * Idle session timeout in minutes. 0 = disabled.
   * After this period of inactivity the user is automatically logged out.
   * Medical software recommendation: 15–30 minutes.
   */
  sessionIdleTimeoutMinutes: num(process.env.SESSION_IDLE_TIMEOUT_MINUTES, 30),
} as const;

export type EnvConfigType = typeof EnvConfig;
