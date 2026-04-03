/**
 * PrometheusService — prom-client wrapper for application metrics.
 *
 * Exposes:
 *   Default Node.js metrics  — CPU, memory, event-loop lag, GC (prefix: zetlab_)
 *   fhir_requests_total       — counter  {resource, method, status}
 *   fhir_request_duration_seconds — histogram {resource, method, status}
 *
 * Usage (instrumentation site — FhirClient.ts):
 *   prometheusService.recordFhirRequest("Patient", "GET", "200", durationSeconds);
 *
 * The /api/metrics route calls prometheusService.metrics() to render the
 * text output that Prometheus scrapes.
 *
 * Server-only module — never import in client components.
 */

import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
} from "prom-client";

const APP_PREFIX = "zetlab_";

class PrometheusService {
  readonly registry: Registry;

  // ── FHIR request counter ──────────────────────────────────────────────────
  private readonly fhirRequestsTotal: Counter<"resource" | "method" | "status">;

  // ── FHIR request duration histogram ──────────────────────────────────────
  private readonly fhirRequestDuration: Histogram<"resource" | "method" | "status">;

  constructor() {
    this.registry = new Registry();

    // Default metrics: process CPU, memory, event-loop lag, GC, handles
    collectDefaultMetrics({
      register: this.registry,
      prefix:   APP_PREFIX,
    });

    this.fhirRequestsTotal = new Counter({
      name:       `${APP_PREFIX}fhir_requests_total`,
      help:       "Total number of FHIR server requests",
      labelNames: ["resource", "method", "status"],
      registers:  [this.registry],
    });

    this.fhirRequestDuration = new Histogram({
      name:       `${APP_PREFIX}fhir_request_duration_seconds`,
      help:       "FHIR request duration in seconds",
      labelNames: ["resource", "method", "status"],
      // Fine-grained low end (FHIR can be fast), coarser at high end
      buckets:    [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers:  [this.registry],
    });
  }

  /**
   * Record one FHIR request.
   * Called from FhirClient after each request completes or fails.
   *
   * @param resource     FHIR resource type extracted from path (e.g. "Patient")
   * @param method       HTTP method ("GET" | "POST")
   * @param status       HTTP status code as string, or "error" on network failure
   * @param durationSec  Request duration in seconds
   */
  recordFhirRequest(
    resource: string,
    method:   string,
    status:   string,
    durationSec: number,
  ): void {
    const labels = { resource, method, status };
    this.fhirRequestsTotal.inc(labels);
    this.fhirRequestDuration.observe(labels, durationSec);
  }

  /** Returns the Prometheus text exposition format for the /api/metrics route. */
  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type header value expected by Prometheus. */
  get contentType(): string {
    return this.registry.contentType;
  }
}

export const prometheusService = new PrometheusService();
