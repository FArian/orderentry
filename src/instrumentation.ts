/**
 * Next.js 15 instrumentation entry point — OpenTelemetry SDK initialisation.
 *
 * Activation:
 *   Set ENABLE_TRACING=true and TRACING_URL=http://<collector>:4318
 *
 * Guarded by two conditions that together prevent any OTel code from running
 * (or being bundled) on Vercel or the Edge runtime:
 *
 *   1. process.env.VERCEL — Vercel sets this to "1" at BUILD time. webpack
 *      replaces it with the literal "1", making the early-return branch
 *      statically dead code. Tree-shaking then removes the entire OTel
 *      import chain before the Edge bundle is created.
 *
 *   2. NEXT_RUNTIME !== "nodejs" — catches any remaining Edge/browser paths
 *      at runtime.
 *
 * On Docker/standalone builds neither guard applies, so tracing works normally.
 */

export async function register(): Promise<void> {
  // Vercel builds: process.env.VERCEL === "1" is inlined at build time.
  // webpack sees `if ("1") return;` and eliminates everything below as dead code.
  if (process.env.VERCEL) return;

  // Edge runtime: never initialise OTel outside Node.js.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

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
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import("@opentelemetry/semantic-conventions");

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
