/**
 * Telemetry entry point — re-exports initTelemetry from the Node.js implementation.
 *
 * On Edge builds, next.config.mjs maps this entire file to telemetry.edge.ts
 * via webpack resolve.alias — so @opentelemetry/* never enters the Edge bundle.
 * On Node.js builds, this file is loaded normally.
 *
 * Do NOT add any logic here. This is a pure re-export so the alias can intercept
 * the entire module at resolution time.
 */

export { initTelemetry } from "./telemetry.node";
