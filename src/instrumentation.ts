/**
 * Next.js 15 instrumentation entry point.
 *
 * OpenTelemetry SDK initialisation lives in instrumentation.node.ts.
 * Next.js loads that file ONLY in the Node.js runtime, which keeps
 * @opentelemetry/* packages out of the Edge/middleware bundle entirely.
 *
 * This file intentionally contains no imports — any import here is
 * visible to the Edge bundler and would re-introduce the build error.
 */

export async function register(): Promise<void> {
  // Delegated to instrumentation.node.ts by Next.js when runtime === "nodejs".
  // Nothing to do here for the Edge runtime.
}
