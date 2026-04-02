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

export const EnvConfig = {
  // ── FHIR ─────────────────────────────────────────────────────────────────
  /** Base URL of the HAPI FHIR R4 server. */
  fhirBaseUrl: str(
    process.env.FHIR_BASE_URL,
    "http://localhost:8080/fhir",
  ),

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
   * Zipkin-compatible collector URL (e.g. http://zipkin:9411).
   * Only used when ENABLE_TRACING=true.
   * Placeholder — connect to opentelemetry-exporter-zipkin when ready.
   */
  zipkinUrl: str(process.env.ZIPKIN_URL, ""),

  /**
   * Grafana instance base URL for log/metrics dashboards.
   * Displayed in the Settings page as a quick-access link.
   */
  grafanaUrl: str(process.env.GRAFANA_URL, ""),
} as const;

export type EnvConfigType = typeof EnvConfig;
