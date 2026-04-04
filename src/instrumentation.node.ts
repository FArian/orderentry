/**
 * Node.js-only OpenTelemetry initialisation.
 *
 * This file is NEVER included in the Edge bundle. Next.js has a built-in
 * webpack plugin (PagesEdgeRouteModulePlugin / instrumentation exclusion)
 * that strips *.node.ts files from Edge compilation. Vercel's post-build
 * __vc__ns__ bundler respects the same convention.
 *
 * There are NO intermediate files in the import chain — OTel is initialised
 * directly here to prevent Vercel's static analyzer from following any path
 * back to @opentelemetry/* packages.
 *
 * Activation:
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
