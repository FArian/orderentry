/**
 * Edge-safe telemetry stub — zero imports, zero side effects.
 *
 * next.config.mjs webpack alias replaces initTelemetry.ts with this file
 * when compiling the Edge bundle. The bundler never opens telemetry.node.ts.
 */

export async function initTelemetry(): Promise<void> {
  // Intentionally empty — Edge runtime has no OTel SDK.
}
