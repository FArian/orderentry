/**
 * Node.js-only startup hook — auto-detected and executed by Next.js 15
 * on the Node.js runtime. Never imported by instrumentation.ts so the
 * Edge bundler (esbuild) never sees this file.
 *
 * Responsibilities:
 *  1. Run DB migrations (SQLite auto-migrate; PostgreSQL via Prisma migrate deploy)
 *  2. Start OpenTelemetry SDK (opt-in via ENABLE_TRACING + TRACING_URL)
 *
 * All imports are dynamic (inside the function body) so that if this file
 * is ever accidentally bundled, webpack/esbuild won't include the full
 * Node.js module tree at build time.
 */

export async function register(): Promise<void> {
  // ── 1. DB migrations ────────────────────────────────────────────────────────
  try {
    const { runMigrations } = await import("@/infrastructure/db/runMigrations");
    await runMigrations();
  } catch (err) {
    console.error("[db] Migration failed — server will not start:", err);
    process.exit(1);
  }

  // ── 2. OpenTelemetry tracing (opt-in) ───────────────────────────────────────
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
