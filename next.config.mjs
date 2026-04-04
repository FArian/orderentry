/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is required for Docker deployment.
  // On Vercel, VERCEL env var is set automatically — standalone must be disabled there.
  output: process.env.VERCEL ? undefined : "standalone",

  /**
   * Mark all @opentelemetry/*, @grpc/*, Prisma, and SQLite packages as
   * Node.js server externals — loaded at runtime from node_modules, never
   * bundled by webpack into the server bundle.
   *
   * These packages are only used in instrumentation.node.ts and server-only
   * infrastructure. instrumentation.node.ts is physically excluded from the
   * Edge bundle by Next.js's built-in *.node.ts webpack plugin, so the
   * Edge runtime never resolves these packages.
   *
   * NOTE: Do NOT add a webpack() function here to push additional externals.
   * webpack's `isServer` flag is true for BOTH Node.js and Edge runtimes.
   * Adding commonjs-style externals to the Edge bundle causes the same
   * "@opentelemetry/api unsupported module" error we are trying to prevent.
   */
  serverExternalPackages: [
    "@opentelemetry/api",
    "@opentelemetry/sdk-node",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/resources",
    "@opentelemetry/semantic-conventions",
    "@grpc/grpc-js",
    "@grpc/proto-loader",
    "better-sqlite3",
    "@prisma/client",
    "prisma",
  ],
};

export default nextConfig;
