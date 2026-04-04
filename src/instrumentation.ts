/**
 * Next.js 15 instrumentation entry point — Edge-safe, no Node.js imports.
 *
 * Node.js-specific startup (DB migrations, OpenTelemetry) lives exclusively
 * in instrumentation.node.ts. Next.js 15 auto-detects that file and runs
 * its register() function on the Node.js runtime without any import from here.
 *
 * This file is compiled for BOTH the Edge runtime (middleware) and the
 * Node.js runtime. It must never import any Node.js-only module — not even
 * via dynamic import() — because Vercel's esbuild-based Edge bundler does
 * not respect /* webpackIgnore *\/ comments.
 */

export async function register(): Promise<void> {
  // Intentionally empty.
  // All startup logic is in instrumentation.node.ts (auto-loaded by Next.js
  // on the Node.js runtime only).
}
