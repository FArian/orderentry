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
    /** Whether distributed tracing is enabled (ENABLE_TRACING env var). */
    enableTracing: EnvConfig.enableTracing,
    /** Zipkin collector URL (empty if not configured). */
    zipkinUrl: EnvConfig.zipkinUrl,
    /** Grafana base URL (empty if not configured). */
    grafanaUrl: EnvConfig.grafanaUrl,
  });
}
