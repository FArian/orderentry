/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is required for Docker deployment.
  // On Vercel, VERCEL env var is set automatically — standalone must be disabled there.
  output: process.env.VERCEL ? undefined : "standalone",

  /**
   * Mark all @opentelemetry/* and @grpc/* packages as Node.js externals.
   *
   * These packages are only used in instrumentation.node.ts, which is never
   * bundled for the Edge runtime. serverExternalPackages prevents webpack from
   * inlining them into the Node.js server bundle — they are loaded at runtime
   * from node_modules.
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
  ],
};

export default nextConfig;
