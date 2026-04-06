/**
 * Node.js-only startup — DB migrations + OpenTelemetry.
 *
 * This file is NEVER included in the Edge bundle. Next.js has a built-in
 * webpack plugin that physically strips *.node.ts files from Edge compilation.
 * Vercel's __vc__ns__ post-build bundler respects the same convention.
 *
 * Static top-level imports are intentional: they are safe here because the
 * file is excluded from the Edge bundle before webpack resolves them.
 *
 * Activation (OTel):
 *   ENABLE_TRACING=true
 *   TRACING_URL=http://<collector>:4318
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { runMigrations } from "@/infrastructure/db/runMigrations";

// ── 1. DB migrations ──────────────────────────────────────────────────────────
async function runStartupMigrations(): Promise<void> {
  try {
    await runMigrations();
  } catch (err) {
    console.error("[db] Migration failed — server will not start:", err);
    process.exit(1);
  }
}

await runStartupMigrations();

// ── 2. OpenTelemetry tracing (opt-in) ─────────────────────────────────────────
if ((process.env.ENABLE_TRACING ?? "").trim().toLowerCase() === "true") {
  const tracingUrl = (process.env.TRACING_URL ?? "").trim();

  if (!tracingUrl) {
    console.warn("[zetlab] ENABLE_TRACING=true but TRACING_URL is not set — tracing disabled.");
  } else {
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
}
