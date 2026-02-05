/**
 * Week 1 Reliability Hardening: process-consult-submission
 *
 * Validates that the reconciliation job is safe to retry and does not duplicate records.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createTestBusiness, createTestCustomer, createTestProduct } from "../utils/factories"
import processConsultSubmissionJob from "../../jobs/process-consult-submission"

jest.setTimeout(60000)

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("process-consult-submission job", () => {
      it("reconciles an orphaned consult_submission and is idempotent on retry", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container)
        const customer = await createTestCustomer(container)
        const product = await createTestProduct(container, true, {
          metadata: { requires_consult: true },
        })

        const businessService = container.resolve("businessModuleService") as any
        const consultationService = container.resolve("consultationModuleService") as any

        const submission = await businessService.createConsultSubmission({
          business_id: business.id,
          location_id: null,
          product_id: product.id,
          customer_id: customer.id,
          idempotency_key: "itest_orphan_001",
          customer_email: customer.email,
          customer_first_name: customer.first_name || "Test",
          customer_last_name: customer.last_name || "Customer",
          customer_phone: null,
          customer_dob: null,
          eligibility_answers: { state: "NY" },
          consult_fee: 2500,
          chief_complaint: "headache",
          medical_history: { prior: "none" },
          notes: "orphan submission test",
          status: "pending",
        })

        // Run twice to assert idempotency.
        await processConsultSubmissionJob(container)
        await processConsultSubmissionJob(container)

        const [consultations] = await consultationService.listConsultations(
          { originating_submission_id: submission.id },
          { take: 10 }
        )
        expect(consultations).toHaveLength(1)

        const approvals = await businessService.listConsultApprovals(
          {
            business_id: business.id,
            customer_id: customer.id,
            product_id: product.id,
            status: "pending",
          },
          { take: 10 }
        )
        expect(approvals).toHaveLength(1)
        expect(approvals[0].consultation_id).toBe(consultations[0].id)
      })
    })
  },
})

