/**
 * Week 1 Reliability Hardening: Consult intake concurrency
 *
 * Validates that concurrent consult submissions do not create duplicate:
 * - consult_submission (pending)
 * - consultation (per submission)
 * - consult_approval (pending)
 * - patient (per business/customer)
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import jwt from "jsonwebtoken"
import { createTestBusiness, createTestCustomer, createTestProduct } from "../utils/factories"

jest.setTimeout(60000)

function signCustomerToken(customerId: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET must be set for integration tests")
  }

  return jwt.sign(
    {
      actor_id: customerId,
      actor_type: "customer",
      auth_identity_id: "",
      app_metadata: {},
      user_metadata: {},
    },
    secret
  )
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Consult intake concurrency", () => {
      let publishableApiKey: string

      beforeEach(async () => {
        const container = getContainer()
        const apiKeyService = container.resolve("api_key") as any

        const key = await apiKeyService.createApiKeys({
          title: "test publishable key (consult concurrency)",
          type: "publishable",
          created_by: "integration_test",
        })

        publishableApiKey = key.token
      })

      it("dedupes 50 concurrent consult submissions for the same customer+product", async () => {
        const container = getContainer()
        const business = await createTestBusiness(container)
        const customer = await createTestCustomer(container)
        const product = await createTestProduct(container, true, {
          metadata: { requires_consult: true },
        })

        const customerToken = signCustomerToken(customer.id)

        const reqBody = {
          product_id: product.id,
          customer_email: customer.email,
          customer_first_name: customer.first_name || "Test",
          customer_last_name: customer.last_name || "Customer",
          eligibility_answers: { state: "NY" },
          consult_fee: 5000,
          notes: "concurrency test",
        }

        const headers = {
          "x-publishable-api-key": publishableApiKey,
          Authorization: `Bearer ${customerToken}`,
          "x-business-slug": business.slug,
        }

        const requests = Array.from({ length: 50 }).map(() =>
          api
            .post(`/store/businesses/${business.slug}/consult`, reqBody, { headers })
            .catch((e: any) => e.response)
        )

        const responses = await Promise.all(requests)
        const bad = responses.filter((r) => ![200, 201].includes(r?.status))
        if (bad.length) {
          const sample = bad[0]
          throw new Error(
            `Unexpected status in concurrent consult intake: ${sample?.status}. ` +
              `Sample body: ${JSON.stringify(sample?.data ?? null).slice(0, 500)}`
          )
        }

        const businessService = container.resolve("businessModuleService") as any
        const consultationService = container.resolve("consultationModuleService") as any

        const submissions = await businessService.listConsultSubmissionsDecrypted(
          {
            business_id: business.id,
            customer_id: customer.id,
            product_id: product.id,
            status: "pending",
            deleted_at: null,
          },
          { take: 50 }
        )
        expect(submissions).toHaveLength(1)

        const [consultations] = await consultationService.listConsultations(
          { originating_submission_id: submissions[0].id },
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

        const [patients] = await consultationService.listPatients(
          { business_id: business.id, customer_id: customer.id },
          { take: 10 }
        )
        expect(patients).toHaveLength(1)
      })
    })
  },
})
