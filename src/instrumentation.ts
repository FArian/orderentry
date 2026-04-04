/**
 * Next.js 15 instrumentation entry point.
 *
 * All OTel code lives in instrumentation.node.ts.
 * Next.js has a built-in webpack plugin that physically excludes any file
 * named *.node.ts from the Edge compilation — Vercel's __vc__ns__ bundler
 * respects this convention. The dynamic import below is never followed
 * in the Edge bundle because the file does not exist in that bundle.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
