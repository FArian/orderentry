/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is required for Docker deployment.
  // On Vercel, VERCEL env var is set automatically — standalone must be disabled there.
  output: process.env.VERCEL ? undefined : "standalone",

  /**
   * Mark all @opentelemetry/* and @grpc/* packages as Node.js externals.
   *
   * serverExternalPackages covers the top-level packages we import directly.
   * The webpack externals function below covers ALL transitive dependencies
   * (e.g. instrumentation-aws-lambda, instrumentation-net, configuration,
   * exporter-prometheus) that also require Node.js built-ins (fs, http, tls).
   *
   * Both are required: serverExternalPackages for Next.js's own bundler pass,
   * webpack externals for the full transitive closure.
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

  webpack(config, { isServer }) {
    if (isServer) {
      // Treat every @opentelemetry/*, @grpc/*, and Node.js built-in as a
      // CommonJS external — loaded from node_modules / Node.js at runtime,
      // never bundled by webpack.
      //
      // Required because instrumentation.ts dynamically imports server-only
      // modules (OTel, better-sqlite3) and webpack statically follows those
      // import chains, hitting Node.js built-ins (fs, path, http, tls, …).
      const NODE_BUILTINS = new Set([
        "fs", "path", "crypto", "http", "https", "http2",
        "tls", "net", "os", "stream", "util", "events",
        "buffer", "child_process", "worker_threads", "perf_hooks",
        "dns", "dgram", "readline", "zlib", "assert", "v8", "vm",
      ]);

      config.externals.push(({ request }, callback) => {
        if (
          request?.startsWith("@opentelemetry/") ||
          request?.startsWith("@grpc/") ||
          NODE_BUILTINS.has(request)
        ) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      });
    }
    return config;
  },
};

export default nextConfig;
