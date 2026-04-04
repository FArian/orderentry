/**
 * OpenTelemetry SDK initialisation — Node.js runtime only.
 *
 * Build-time dead code elimination (CRITICAL):
 *   Vercel sets process.env.VERCEL = "1" at BUILD time.
 *   The bundler constant-folds the guard before tree-shaking:
 *
 *     if ("1") return;   ← unreachable code below → stripped from bundle
 *
 *   Result: no @opentelemetry/* reference ever reaches the Edge bundle.
 *
 * This function is never imported directly. It is loaded exclusively via
 * a dynamic import inside instrumentation.ts, which is itself guarded —
 * giving two independent layers of build-time dead code elimination.
 *
 * Activation (Docker / Node.js only):
 *   ENABLE_TRACING=true
 *   TRACING_URL=http://<collector>:4318
 */

export async function initTelemetry(): Promise<void> {
  // ── Layer 1: build-time guard ────────────────────────────────────────────────
  // MUST be the first statement. process.env.VERCEL is a BUILD-TIME constant on
  // Vercel — the bundler replaces it with "1" before analysis, making all code
  // below statically unreachable and removing it from the bundle entirely.
  if (process.env.VERCEL) return;

  // ── Layer 2: feature flag ────────────────────────────────────────────────────
  if ((process.env.ENABLE_TRACING ?? "").trim().toLowerCase() !== "true") return;

  const tracingUrl = (process.env.TRACING_URL ?? "").trim();
  if (!tracingUrl) {
    console.warn("[zetlab] ENABLE_TRACING=true but TRACING_URL is not set — tracing disabled.");
    return;
  }

  // ── Dynamic imports keep OTel out of the static module graph ─────────────────
  // Even if the guard above were somehow reached in an Edge context, these
  // dynamic imports are inside the dead-code branch and are never analyzed.
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
        // Disable noisy low-level instrumentations.
        "@opentelemetry/instrumentation-fs":  { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Flush pending spans before the process exits.
  process.on("SIGTERM", () => { sdk.shutdown().catch(() => undefined); });
  process.on("SIGINT",  () => { sdk.shutdown().catch(() => undefined); });

  console.info(`[zetlab] OpenTelemetry tracing started → ${tracingUrl}`);
}
