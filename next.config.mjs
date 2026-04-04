/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is required for Docker deployment.
  // On Vercel, VERCEL env var is set automatically — standalone must be disabled there.
  output: process.env.VERCEL ? undefined : "standalone",

  /**
   * Exclude the entire @opentelemetry/* and @grpc/* package namespaces from
   * Webpack bundling. These packages use Node.js built-ins (fs, stream, tls,
   * net, http, path, zlib) that Webpack cannot resolve for the browser bundle.
   *
   * instrumentation.ts is a server-only Next.js hook — the OTel SDK must only
   * run in the Node.js runtime. Using a webpack externals function covers all
   * transitive dependencies automatically, which is why we use this approach
   * instead of a static serverExternalPackages list (whack-a-mole otherwise).
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
          // Exclude server-only packages that use Node.js built-ins
          // (stream, fs, tls, net, http, path, zlib, …).
          // These are only used in instrumentation.ts (OTel SDK) and API routes —
          // they must never enter the Webpack client bundle.
          //   @opentelemetry/* — OTLP exporters, auto-instrumentations
          //   @grpc/*          — gRPC transport (transitive OTel dep)
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
