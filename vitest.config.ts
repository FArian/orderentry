import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Expose describe, it, expect, vi, beforeEach etc. globally — no imports needed in test files
    globals: true,

    // Browser-like environment so DOM APIs are available in component tests
    environment: "jsdom",

    // Runs before each test file — loads jest-dom matchers and the jest ↔ vi shim
    setupFiles: ["./vitest.setup.ts"],

    // Mirror the same roots as jest.config.ts
    include: [
      "tests/**/*.{test,spec}.{ts,tsx}",
      "src/**/*.{test,spec}.{ts,tsx}",
    ],

    coverage: {
      provider: "v8",
      include: [
        "src/domain/**/*.ts",
        "src/application/**/*.ts",
        "src/infrastructure/fhir/**/*.ts",
        "src/infrastructure/repositories/**/*.ts",
        "src/infrastructure/api/**/*.ts",
      ],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },

  resolve: {
    // Must mirror tsconfig.json paths so @/* imports resolve
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
