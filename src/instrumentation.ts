/**
 * Next.js 15 instrumentation entry point.
 *
 * All Node.js-only startup code lives in instrumentation.node.ts.
 * Next.js has a built-in webpack plugin that physically strips any file
 * named *.node.ts from the Edge compilation — Vercel's __vc__ns__ bundler
 * respects this convention. The conditional import below is therefore never
 * resolved in the Edge bundle, and @opentelemetry/* never enters it.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
