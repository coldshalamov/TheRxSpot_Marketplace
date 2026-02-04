/**
 * Test Server Setup and Utilities
 * 
 * Provides test server initialization, database management,
 * and helper functions for integration testing.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaContainer } from "@medusajs/framework/types"

// Module constants for service resolution (match `src/modules/*/index.ts`)
import { BUSINESS_MODULE } from "../../modules/business"
import { COMPLIANCE_MODULE } from "../../modules/compliance"
import { CONSULTATION_MODULE } from "../../modules/consultation"
import { FINANCIALS_MODULE } from "../../modules/financials"

export { BUSINESS_MODULE, COMPLIANCE_MODULE, CONSULTATION_MODULE, FINANCIALS_MODULE }

// Test context interface
export interface TestContext {
  container: MedusaContainer
  api: any
  db: {
    client: any
    destroy: () => Promise<void>
  }
}

// Global test configuration
export const TEST_CONFIG = {
  // Database configuration (uses separate test database)
  database: {
    schema: "public",
    extra: {
      connectionTimeoutMillis: 10000,
    },
  },
  // Test timeouts
  timeouts: {
    default: 30000,
    long: 60000,
  },
}

/**
 * Initialize test server with Medusa test runner
 */
export async function initializeTestServer(
  testFn: (context: TestContext) => Promise<void>
): Promise<void> {
  await medusaIntegrationTestRunner({
    test: testFn,
    env: {
      NODE_ENV: "test",
    },
  })
}

/**
 * Get services from container
 */
export function getServices(container: MedusaContainer) {
  return {
    // Core Medusa modules
    product: container.resolve("product"),
    customer: container.resolve("customer"),
    order: container.resolve("order"),
    cart: container.resolve("cart"),
    payment: container.resolve("payment"),
    
    // Custom modules
    business: container.resolve(BUSINESS_MODULE),
    compliance: container.resolve(COMPLIANCE_MODULE),
    consultation: container.resolve(CONSULTATION_MODULE),
    financials: container.resolve(FINANCIALS_MODULE),
  }
}

/**
 * Clear test data from database
 * Call this in afterEach to ensure test isolation
 */
export async function clearTestData(container: MedusaContainer): Promise<void> {
  const {
    business,
    compliance,
    consultation,
    financials,
  } = getServices(container)

  try {
    // Clear in reverse dependency order
    const auditLogs = await compliance.listAuditLogs({}, { take: 1000 })
    for (const log of auditLogs[0] || []) {
      await compliance.deleteAuditLogs(log.id)
    }

    const documents = await compliance.listDocuments({}, { take: 1000 })
    for (const doc of documents[0] || []) {
      await compliance.deleteDocuments(doc.id)
    }

    const payouts = await financials.listPayouts({}, { take: 1000 })
    for (const payout of payouts[0] || []) {
      await financials.deletePayouts(payout.id)
    }

    const earnings = await financials.listEarningEntries({}, { take: 1000 })
    for (const earning of earnings[0] || []) {
      await financials.deleteEarningEntries(earning.id)
    }

    const statusEvents = await consultation.listConsultationStatusEvents({}, { take: 1000 })
    for (const event of statusEvents[0] || []) {
      await consultation.deleteConsultationStatusEvents(event.id)
    }

    const consultations = await consultation.listConsultations({}, { take: 1000 })
    for (const consult of consultations[0] || []) {
      await consultation.deleteConsultations(consult.id)
    }

    const schedules = await consultation.listClinicianSchedules({}, { take: 1000 })
    for (const schedule of schedules[0] || []) {
      await consultation.deleteClinicianSchedules(schedule.id)
    }

    const exceptions = await consultation.listClinicianAvailabilityExceptions({}, { take: 1000 })
    for (const exception of exceptions[0] || []) {
      await consultation.deleteClinicianAvailabilityExceptions(exception.id)
    }

    const clinicians = await consultation.listClinicians({}, { take: 1000 })
    for (const clinician of clinicians[0] || []) {
      await consultation.deleteClinicians(clinician.id)
    }

    const patients = await consultation.listPatients({}, { take: 1000 })
    for (const patient of patients[0] || []) {
      await consultation.deletePatients(patient.id)
    }

    const approvals = await business.listConsultApprovals({}, { take: 1000 })
    for (const approval of approvals[0] || []) {
      await business.deleteConsultApprovals(approval.id)
    }

    const submissions = await business.listConsultSubmissions({}, { take: 1000 })
    for (const sub of submissions[0] || []) {
      await business.deleteConsultSubmissions(sub.id)
    }

    const orderEvents = await business.listOrderStatusEvents({}, { take: 1000 })
    for (const event of orderEvents[0] || []) {
      await business.deleteOrderStatusEvents(event.id)
    }

    const businesses = await business.listBusinesses({}, { take: 1000 })
    for (const b of businesses[0] || []) {
      await business.deleteBusinesses(b.id)
    }
  } catch (error: any) {
    // Log but don't throw - tests should handle individual cleanup
    console.log("Cleanup warning:", error.message)
  }
}

/**
 * Generate unique IDs for tests
 */
export function generateTestId(prefix: string = "test"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create mock request/response objects for middleware testing
 */
export function createMockRequest(overrides: any = {}) {
  return {
    method: "GET",
    path: "/",
    body: {},
    headers: {},
    scope: {
      resolve: jest.fn(),
    },
    ...overrides,
  }
}

export function createMockResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    statusCode: 200,
  }
  return res
}

export function createMockNext() {
  return jest.fn()
}

/**
 * Wait for async operations to complete
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate date offsets for testing
 */
export function dateOffset(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

/**
 * Mock external services
 */
export function mockExternalServices() {
  // Mock S3/document storage
  jest.mock("@aws-sdk/client-s3", () => ({
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({}),
    })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
  }))

  // Mock Stripe
  jest.mock("stripe", () => {
    return jest.fn().mockImplementation(() => ({
      transfers: {
        create: jest.fn().mockResolvedValue({ id: "tr_test_123" }),
      },
      accounts: {
        create: jest.fn().mockResolvedValue({ id: "acct_test_123" }),
      },
    }))
  })
}

/**
 * Setup before all tests
 */
export async function setupTestEnvironment(): Promise<void> {
  // Set test environment
  process.env.NODE_ENV = "test"
  process.env.JWT_SECRET = "test_jwt_secret_128_chars_long_for_testing_purposes_only_" + "x".repeat(70)
  process.env.COOKIE_SECRET = "test_cookie_secret_128_chars_long_for_testing_purposes_only_" + "x".repeat(70)
  
  // Mock external services
  mockExternalServices()
}

/**
 * Teardown after all tests
 */
export async function teardownTestEnvironment(): Promise<void> {
  // Cleanup any remaining mocks
  jest.restoreAllMocks()
}
