/**
 * Next.js 15 instrumentation entry point.
 *
 * Delegates to initTelemetry, which routes to telemetry.node.ts (Docker/Node)
 * or telemetry.edge.ts (Edge/Vercel) based on two independent build-time
 * mechanisms. See src/infrastructure/telemetry/initTelemetry.ts for details.
 */

export async function register(): Promise<void> {
  const { initTelemetry } = await import(
    "@/infrastructure/telemetry/initTelemetry"
  );
  await initTelemetry();
}
