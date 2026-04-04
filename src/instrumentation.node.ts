/**
 * Node.js-only OpenTelemetry initialisation.
 *
 * Imported dynamically from instrumentation.ts inside the nodejs runtime guard.
 * All OTel imports are dynamic (inside the function body) so webpack never
 * statically bundles Node.js built-ins (fs, http, path, tls) into the
 * client or Edge bundles.
 *
 * Activation:
 *   ENABLE_TRACING=true
 *   TRACING_URL=http://<collector>:4318
 */

export async function register(): Promise<void> {
  // ── OpenTelemetry tracing (optional) ─────────────────────────────────────────
  if ((process.env.ENABLE_TRACING ?? "").trim().toLowerCase() !== "true") return;

  const tracingUrl = (process.env.TRACING_URL ?? "").trim();
  if (!tracingUrl) {
    console.warn("[zetlab] ENABLE_TRACING=true but TRACING_URL is not set — tracing disabled.");
    return;
  }

  const [
    { NodeSDK },
    { OTLPTraceExporter },
    { getNodeAutoInstrumentations },
    { resourceFromAttributes },
    { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION },
  ] = await Promise.all([
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/exporter-trace-otlp-http"),
    import("@opentelemetry/auto-instrumentations-node"),
    import("@opentelemetry/resources"),
    import("@opentelemetry/semantic-conventions"),
  ]);

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]:    "zetlab-orderentry",
      [ATTR_SERVICE_VERSION]: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
    }),
    traceExporter: new OTLPTraceExporter({
      url: tracingUrl.endsWith("/v1/traces")
        ? tracingUrl
        : `${tracingUrl}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs":  { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on("SIGTERM", () => { sdk.shutdown().catch(() => undefined); });
  process.on("SIGINT",  () => { sdk.shutdown().catch(() => undefined); });

  console.info(`[zetlab] OpenTelemetry tracing started → ${tracingUrl}`);
}
