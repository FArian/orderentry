/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is required for Docker deployment.
  // On Vercel, VERCEL env var is set automatically — standalone must be disabled there.
  output: process.env.VERCEL ? undefined : "standalone",

  /**
   * Mark all @opentelemetry/* and @grpc/* packages as Node.js externals.
   *
   * This tells Next.js (and Vercel's build pipeline) not to bundle these
   * packages. They are loaded at runtime from node_modules on the Node.js
   * server. The Edge bundle never receives a reference because:
   *
   *   1. serverExternalPackages excludes them from bundling analysis.
   *   2. instrumentation.ts guards the dynamic import with process.env.VERCEL,
   *      which the bundler constant-folds to "1" on Vercel builds, making the
   *      import statically dead code (see instrumentation.ts for details).
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

  /**
   * Webpack externals for the Node.js server bundle.
   *
   * serverExternalPackages handles the module exclusion at the Next.js level.
   * This webpack function provides a complementary regex-based exclusion that
   * catches all transitive @opentelemetry/* and @grpc/* sub-packages that are
   * not listed explicitly above (e.g. @opentelemetry/instrumentation-http).
   */
  webpack(config, { isServer }) {
    if (isServer) {
      const prior = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];

      config.externals = [
        ...prior,
        ({ request }, callback) => {
          if (/^(@opentelemetry|@grpc)\//.test(request)) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
