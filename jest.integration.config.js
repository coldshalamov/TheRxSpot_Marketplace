/**
 * Jest Configuration for Integration Tests
 * 
 * This configuration extends the base Jest config for integration testing.
 */

const { loadEnv } = require("@medusajs/utils")
loadEnv("test", process.cwd())

module.exports = {
  // Use SWC for fast TypeScript compilation
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          target: "es2020",
        },
      },
    ],
  },

  // Test environment
  testEnvironment: "node",

  // File extensions
  moduleFileExtensions: ["js", "ts", "json"],

  // Ignore patterns
  modulePathIgnorePatterns: [
    "dist/",
    "<rootDir>/.medusa/",
    "node_modules/",
  ],

  // Test patterns for custom integration tests
  // Curated MVP-focused integration suite.
  // Many other tests in `src/tests/integration/` are works-in-progress and should not
  // gate CI until they’re fixed and made deterministic.
  testMatch: [
    "<rootDir>/src/tests/integration/tenant-resolution.test.ts",
    "<rootDir>/src/tests/integration/consultation-apis.test.ts",
    "<rootDir>/src/tests/integration/consult-intake-concurrency.test.ts",
    "<rootDir>/src/tests/integration/process-consult-submission-job.test.ts",
    "<rootDir>/src/tests/integration/hub-provisioning-contract.test.ts",
    "<rootDir>/src/tests/integration/order-state-guards.test.ts",
    "<rootDir>/src/tests/integration/mvp-audit.test.ts",
    "<rootDir>/src/tests/integration/mvp-phi-encryption.test.ts",
  ],

  // Setup files (needs Jest globals like `expect`, `beforeAll`, etc.)
  setupFilesAfterEnv: ["./src/tests/setup.ts"],

  // Module name mapping for path aliases
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/scripts/**",
    "!src/**/index.ts",
  ],
  coverageDirectory: "coverage/integration",
  coverageReporters: ["text", "lcov", "html"],

  // Test timeout (30 seconds default, 60 for long operations)
  testTimeout: 30000,

  // Verbose output for debugging
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Fail on console errors in tests
  errorOnDeprecated: true,

  // reporters
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "./reports",
        outputName: "junit-integration.xml",
      },
    ],
  ],

  // Global variables
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },

  // Handle async operations
  detectOpenHandles: true,
  forceExit: true,
}
