/**
 * Next.js 15 instrumentation entry point.
 *
 * Two independent build-time guards prevent any OpenTelemetry code from
 * reaching the Edge bundle:
 *
 *   Guard 1 (here): the dynamic import of initTelemetry is inside a
 *     `if (process.env.VERCEL) return;` branch. On Vercel, the bundler
 *     constant-folds VERCEL="1", making the import statically unreachable.
 *     The Edge analyser never opens initTelemetry.ts.
 *
 *   Guard 2 (initTelemetry.ts): identical guard at the top of the function,
 *     providing a second layer for non-Vercel Edge environments.
 *
 * No static imports appear in this file — a static import would force the
 * bundler to analyse initTelemetry.ts regardless of the runtime guard.
 */

export async function register(): Promise<void> {
  // Build-time dead code elimination — see module comment above.
  if (process.env.VERCEL) return;

  // Dynamic import: the bundler only follows this path when the guard above
  // is false (Docker / local dev), so initTelemetry.ts is invisible to the
  // Vercel Edge analyser.
  const { initTelemetry } = await import(
    "@/infrastructure/telemetry/initTelemetry"
  );
  await initTelemetry();
}
