/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is required for Docker deployment.
  // On Vercel, VERCEL env var is set automatically — standalone must be disabled there.
  output: process.env.VERCEL ? undefined : "standalone",

  // Keep OpenTelemetry and gRPC packages out of the Webpack client bundle.
  // These are pure Node.js packages (they import stream, fs, tls, net, zlib)
  // and must only run in the Node.js runtime via instrumentation.ts.
  // Without this, the Next.js build fails with "Module not found: Can't resolve 'stream'" etc.
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/exporter-logs-otlp-grpc",
    "@opentelemetry/otlp-grpc-exporter-base",
    "@opentelemetry/instrumentation-winston",
    "@grpc/grpc-js",
  ],
};

export default nextConfig;
