/**
 * Node.js-only OpenTelemetry initialisation.
 *
 * This file MUST NEVER be imported by middleware.ts or any Edge-reachable
 * module. It is excluded from the Edge bundle via a webpack resolve.alias
 * in next.config.mjs, which replaces this file with telemetry.edge.ts
 * at module-resolution time — before any bundler analysis runs.
 *
 * Activation:
 *   ENABLE_TRACING=true
 *   TRACING_URL=http://<collector>:4318
 */

export async function initTelemetry(): Promise<void> {
  if ((process.env.ENABLE_TRACING ?? "").trim().toLowerCase() !== "true") return;

  const tracingUrl = (process.env.TRACING_URL ?? "").trim();
  if (!tracingUrl) {
    console.warn("[zetlab] ENABLE_TRACING=true but TRACING_URL is not set — tracing disabled.");
    return;
  }

  const { NodeSDK }                     = await import("@opentelemetry/sdk-node");
  const { OTLPTraceExporter }           = await import("@opentelemetry/exporter-trace-otlp-http");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
  const { resourceFromAttributes }      = await import("@opentelemetry/resources");
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } =
    await import("@opentelemetry/semantic-conventions");

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
