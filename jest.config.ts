import type { Config } from "jest";

const config: Config = {
  // Use ts-jest to handle TypeScript files
  preset: "ts-jest",

  // Browser-like environment (needed for DOM APIs used in components)
  testEnvironment: "jest-environment-jsdom",

  // Run this file before each test suite
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // Path aliases — must mirror tsconfig.json paths
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // Directories Jest will look for tests in
  roots: ["<rootDir>/tests", "<rootDir>/src"],

  // Which files count as tests
  testMatch: [
    "**/__tests__/**/*.{ts,tsx}",
    "**/*.{test,spec}.{ts,tsx}",
  ],

  // Files Jest will transform
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.jest.json",
      },
    ],
  },

  // Ignore Next.js build output and node_modules
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Coverage source files
  collectCoverageFrom: [
    "src/domain/**/*.ts",
    "src/application/**/*.ts",
    "src/infrastructure/fhir/**/*.ts",
    "src/infrastructure/repositories/**/*.ts",
    "!src/**/*.d.ts",
  ],

  // Verbose output for CI
  verbose: true,
};

export default config;
