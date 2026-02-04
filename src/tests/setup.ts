/**
 * Global Test Setup
 * 
 * This file runs before all tests to configure the test environment.
 * It handles database connections, mocking, and global test utilities.
 */

import { MetadataStorage } from "@medusajs/framework/mikro-orm/core"

// Clear metadata before tests to prevent conflicts
MetadataStorage.clear()

// Set test environment
process.env.NODE_ENV = "test"
process.env.TZ = "UTC"

// JWT secrets for testing (128+ characters as required)
process.env.JWT_SECRET = "test_jwt_secret_128_chars_long_for_testing_purposes_only_" + "x".repeat(70)
process.env.COOKIE_SECRET = "test_cookie_secret_128_chars_long_for_testing_purposes_only_" + "x".repeat(70)

// Test database configuration
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

// Disable logging in tests unless explicitly enabled
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL || "silent"

// ============================================================================
// Mock External Services
// ============================================================================

// Mock AWS S3
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      Body: {
        transformToByteArray: jest.fn().mockResolvedValue(Buffer.from("test")),
      },
    }),
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
  GetObjectCommand: jest.fn().mockImplementation((params) => params),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => params),
  HeadObjectCommand: jest.fn().mockImplementation((params) => params),
}))

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://presigned-url.s3.amazonaws.com/test"),
}))

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    transfers: {
      create: jest.fn().mockResolvedValue({ id: "tr_test_123" }),
    },
    accounts: {
      create: jest.fn().mockResolvedValue({ id: "acct_test_123" }),
      retrieve: jest.fn().mockResolvedValue({ id: "acct_test_123" }),
    },
    balanceTransactions: {
      list: jest.fn().mockResolvedValue({ data: [] }),
    },
    payouts: {
      create: jest.fn().mockResolvedValue({ id: "po_test_123" }),
    },
  }))
})

// Mock SendGrid / Email services
jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{}, {}]),
}))

// Mock Twilio / SMS services
jest.mock("twilio", () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: "SM_test_123" }),
    },
  }))
})

// Mock HTTP requests
jest.mock("axios", () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
}))

// ============================================================================
// Global Test Utilities
// ============================================================================

declare global {
  var testTimeout: number
}

// Set default test timeout
global.testTimeout = 30000

// Extend Jest matchers if needed
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },
})

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

beforeAll(async () => {
  // Global setup before all tests
  console.log("🧪 Starting test suite...")
})

afterAll(async () => {
  // Global cleanup after all tests
  console.log("✅ Test suite completed")
  
  // Restore all mocks
  jest.restoreAllMocks()
})

beforeEach(async () => {
  // Setup before each test
  // Reset mocks that should be fresh for each test
  jest.clearAllMocks()
})

afterEach(async () => {
  // Cleanup after each test
})

// ============================================================================
// Error Handling
// ============================================================================

// Handle unhandled promises
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
})

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
  process.exit(1)
})
