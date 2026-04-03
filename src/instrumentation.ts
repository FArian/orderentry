/**
 * Next.js 15 instrumentation entry point.
 *
 * Called once at server startup — before any request is served.
 * This is the only place where the OpenTelemetry SDK is initialised.
 *
 * Activation:
 *   Set ENABLE_TRACING=true and TRACING_URL=http://<collector>:4318
 *   The TRACING_URL must point to an OTLP/HTTP endpoint, e.g.:
 *     - Jaeger all-in-one:  http://jaeger:4318
 *     - Grafana Tempo:      http://tempo:4318
 *     - OpenTelemetry Collector: http://otel-collector:4318
 *
 * When ENABLE_TRACING is not set or false, this function returns immediately
 * and adds zero overhead to the running application.
 */

export async function register(): Promise<void> {
  // Only initialise on the Node.js runtime — never on Edge or browser.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if ((process.env.ENABLE_TRACING ?? "").trim().toLowerCase() !== "true") return;

  const tracingUrl = (process.env.TRACING_URL ?? "").trim();
  if (!tracingUrl) {
    console.warn(
      '[zetlab] ENABLE_TRACING=true but TRACING_URL is not set — tracing disabled.',
    );
    return;
  }

  const { NodeSDK }                     = await import("@opentelemetry/sdk-node");
  const { OTLPTraceExporter }           = await import("@opentelemetry/exporter-trace-otlp-http");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
  const { resourceFromAttributes }      = await import("@opentelemetry/resources");
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import("@opentelemetry/semantic-conventions");

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]:    "zetlab-orderentry",
      [ATTR_SERVICE_VERSION]: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
    }),

    traceExporter: new OTLPTraceExporter({
      // OTLP/HTTP traces endpoint — append /v1/traces if not already present.
      url: tracingUrl.endsWith("/v1/traces")
        ? tracingUrl
        : `${tracingUrl}/v1/traces`,
    }),

    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy fs instrumentation (reads every source file on startup).
        "@opentelemetry/instrumentation-fs":       { enabled: false },
        // Disable DNS — too low-level for application tracing.
        "@opentelemetry/instrumentation-dns":      { enabled: false },
        // Keep HTTP, fetch, Next.js, and custom spans enabled.
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown — flush pending spans before the process exits.
  process.on("SIGTERM", () => { sdk.shutdown().catch(() => undefined); });
  process.on("SIGINT",  () => { sdk.shutdown().catch(() => undefined); });

  console.info(`[zetlab] OpenTelemetry tracing started → ${tracingUrl}`);
}
