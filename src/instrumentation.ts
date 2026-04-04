/**
 * Next.js 15 instrumentation entry point.
 *
 * This file intentionally contains NO imports and NO references to any
 * Node.js-only module. Vercel's Edge bundler analyzes this file statically
 * and follows every import string — even inside runtime guards.
 *
 * OpenTelemetry initialization lives in instrumentation.node.ts.
 * Next.js 15 calls register() from that file AUTOMATICALLY on the Node.js
 * runtime — no import from here is needed or allowed.
 */

export async function register(): Promise<void> {
  // Intentionally empty.
  // Node.js startup is handled by instrumentation.node.ts (auto-called by Next.js).
}
