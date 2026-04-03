/**
 * GET /api/settings — returns non-sensitive server-side configuration.
 *
 * Used by the Settings page to display current server config (read-only).
 * Secrets (AUTH_SECRET, database credentials) are never included.
 */

import { NextResponse } from "next/server";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { AppConfig } from "@/shared/config/AppConfig";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    /** Active server log level (set via LOG_LEVEL env var). */
    logLevel: EnvConfig.logLevel,
    /** Whether file logging is active (LOG_FILE is set). */
    fileLoggingEnabled: !!EnvConfig.logFile,
    /** FHIR server base URL (internal — not a secret, useful for diagnostics). */
    fhirBaseUrl: EnvConfig.fhirBaseUrl,
    /** Application version injected at build time. */
    appVersion: AppConfig.appVersion,
    /** Active FHIR auth type (display-only; credentials are never returned). */
    fhirAuthType: EnvConfig.fhirAuthType,
    /** Whether distributed tracing is enabled (ENABLE_TRACING env var). */
    enableTracing: EnvConfig.enableTracing,
    /** Tracing collector URL (empty if not configured). */
    tracingUrl: EnvConfig.tracingUrl,
    /** Monitoring/dashboard base URL (empty if not configured). */
    monitoringUrl: EnvConfig.monitoringUrl,
    /** Custom display label for the monitoring system (e.g. "Grafana"). Empty = use default. */
    monitoringLabel: EnvConfig.monitoringLabel,
    /** Custom display label for the tracing system (e.g. "Zipkin", "Jaeger"). Empty = use default. */
    tracingLabel: EnvConfig.tracingLabel,
    /** Active mail provider (display-only; credentials are never returned). */
    mailProvider: EnvConfig.mailProvider,
    /** Active mail auth type (display-only). */
    mailAuthType: EnvConfig.mailAuthType,
    /** Configured sender address (display-only; no secret). */
    mailFrom: EnvConfig.mailFrom || (EnvConfig.mailUser ? `OrderEntry <${EnvConfig.mailUser}>` : ""),
  });
}
