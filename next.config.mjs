import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is required for Docker deployment.
  // On Vercel, VERCEL env var is set automatically — standalone must be disabled there.
  output: process.env.VERCEL ? undefined : "standalone",

  /**
   * Mark all @opentelemetry/* and @grpc/* packages as Node.js externals.
   * They are loaded at runtime from node_modules — never bundled.
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

  webpack(config, { isServer, nextRuntime }) {
    // ── PRIMARY: Swap initTelemetry.ts → telemetry.edge.ts on Edge builds ────────
    //
    // When `nextRuntime === "edge"`, webpack compiles the Edge bundle (middleware +
    // Edge API routes). We replace the entire initTelemetry module with the empty
    // Edge stub AT MODULE RESOLUTION TIME — before the bundler opens any file.
    //
    // Because the alias targets the entry-point file itself (initTelemetry.ts),
    // webpack never follows the `export { initTelemetry } from "./telemetry.node"`
    // re-export and therefore never opens telemetry.node.ts. @opentelemetry/*
    // has no path into the Edge dependency graph.
    //
    // This works because:
    //   - Aliases are resolved by absolute path AFTER webpack resolves the full path
    //   - initTelemetry.ts is the single entry point; aliasing it is sufficient
    //   - telemetry.edge.ts has zero imports — the substitution is terminal
    if (nextRuntime === "edge") {
      config.resolve = {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          // Alias the entry-point module (with and without extension for safety)
          [path.resolve(__dirname, "src/infrastructure/telemetry/initTelemetry.ts")]:
            path.resolve(__dirname, "src/infrastructure/telemetry/telemetry.edge.ts"),
          [path.resolve(__dirname, "src/infrastructure/telemetry/initTelemetry")]:
            path.resolve(__dirname, "src/infrastructure/telemetry/telemetry.edge.ts"),
        },
      };
    }

    // ── SECONDARY: Keep @opentelemetry/* external in the Node.js server bundle ───
    // serverExternalPackages handles this at the Next.js level.
    // The regex below catches transitive sub-packages not listed explicitly above.
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
