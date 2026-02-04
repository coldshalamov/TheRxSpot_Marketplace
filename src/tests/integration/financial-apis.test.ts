/**
 * Financial API Endpoint Tests (PLAN)
 *
 * Covers:
 * - GET /admin/earnings/summary (filters + breakdown + cents math)
 * - POST /admin/payouts (amount-based from available balance + idempotency + audit logs)
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import jwt from "jsonwebtoken"
import { createTestBusiness, createTestEarningEntry } from "../utils/factories"

jest.setTimeout(60000)

function signAdminToken(userId: string, businessId?: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET must be set for integration tests")
  }

  return jwt.sign(
    {
      actor_id: userId,
      actor_type: "user",
      auth_identity_id: "",
      business_id: businessId,
      app_metadata: businessId ? { business_id: businessId } : {},
      user_metadata: {},
    },
    secret
  )
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Financial APIs (PLAN)", () => {
      it("calculates earnings summary with filters and breakdown", async () => {
        const container = getContainer()
        const business = await createTestBusiness(container)

        // Available earnings
        await createTestEarningEntry(container, "available", {
          business_id: business.id,
          type: "product_sale",
          gross_amount: 10000,
          platform_fee: 500,
          payment_processing_fee: 100,
          net_amount: 9400,
        })

        await createTestEarningEntry(container, "available", {
          business_id: business.id,
          type: "consultation_fee",
          gross_amount: 20000,
          platform_fee: 2000,
          payment_processing_fee: 0,
          net_amount: 18000,
        })

        // Pending payout (already requested)
        await createTestEarningEntry(container, "paid_out", {
          business_id: business.id,
          type: "shipping_fee",
          gross_amount: 3000,
          platform_fee: 300,
          payment_processing_fee: 50,
          net_amount: 2650,
          payout_id: "payout_test_01",
        })

        const adminToken = signAdminToken("user_admin_fin_01", business.id)
        const dateFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
        const dateTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

        const res = await api
          .get(
            `/admin/earnings/summary?business_id=${business.id}&date_from=${encodeURIComponent(
              dateFrom
            )}&date_to=${encodeURIComponent(dateTo)}`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        if (res.status !== 200) {
          throw new Error(`Unexpected response: ${res.status} ${JSON.stringify(res.data)}`)
        }
        expect(res.status).toBe(200)

        // Cents math: total earnings = sum(net) across non-reversed
        expect(res.data.total_earnings).toBe(9400 + 18000 + 2650)
        // Commission balance / available payout = available net sum
        expect(res.data.commission_balance).toBe(9400 + 18000)
        expect(res.data.available_payout).toBe(9400 + 18000)
        // Pending payout = earnings already linked to payout
        expect(res.data.pending_payout).toBe(2650)

        expect(res.data.breakdown).toMatchObject({
          commission: 9400,
          consultation_fee: 18000,
          service_fee: 2650,
        })
      })

      it("creates a payout request from available balance and is idempotent with Idempotency-Key", async () => {
        const container = getContainer()
        const business = await createTestBusiness(container)

        const e1 = await createTestEarningEntry(container, "available", {
          business_id: business.id,
          type: "product_sale",
          gross_amount: 22000,
          platform_fee: 2000,
          payment_processing_fee: 0,
          net_amount: 20000,
        })
        const e2 = await createTestEarningEntry(container, "available", {
          business_id: business.id,
          type: "product_sale",
          gross_amount: 33000,
          platform_fee: 3000,
          payment_processing_fee: 0,
          net_amount: 30000,
        })
        const e3 = await createTestEarningEntry(container, "available", {
          business_id: business.id,
          type: "shipping_fee",
          gross_amount: 11000,
          platform_fee: 1000,
          payment_processing_fee: 0,
          net_amount: 10000,
        })

        const adminToken = signAdminToken("user_admin_fin_02", business.id)
        const idempotencyKey = "itest-payout-001"

        const createRes = await api
          .post(
            `/admin/payouts`,
            {
              business_id: business.id,
              amount: 50000,
              method: "stripe_connect",
              destination_account: "acct_test",
            },
            {
              headers: {
                Authorization: `Bearer ${adminToken}`,
                "Idempotency-Key": idempotencyKey,
              },
            }
          )
          .catch((e: any) => e.response)

        if (createRes.status !== 201) {
          throw new Error(`Unexpected response: ${createRes.status} ${JSON.stringify(createRes.data)}`)
        }
        expect(createRes.status).toBe(201)
        expect(createRes.data.payout).toBeDefined()
        expect(createRes.data.payout.net_amount).toBe(50000)
        expect(createRes.data.payout.business_id).toBe(business.id)

        const payoutId = createRes.data.payout.id as string

        const financials = container.resolve("financialsModuleService") as any
        const updatedE1 = await financials.retrieveEarningEntry(e1.id)
        const updatedE2 = await financials.retrieveEarningEntry(e2.id)
        const updatedE3 = await financials.retrieveEarningEntry(e3.id)

        expect(updatedE1.payout_id).toBe(payoutId)
        expect(updatedE2.payout_id).toBe(payoutId)
        // not included
        expect(updatedE3.payout_id).toBeNull()

        // Second request with same key returns same payout (no duplicate payouts)
        const secondRes = await api
          .post(
            `/admin/payouts`,
            {
              business_id: business.id,
              amount: 50000,
              method: "stripe_connect",
              destination_account: "acct_test",
            },
            {
              headers: {
                Authorization: `Bearer ${adminToken}`,
                "Idempotency-Key": idempotencyKey,
              },
            }
          )
          .catch((e: any) => e.response)

        expect(secondRes.status).toBe(200)
        expect(secondRes.data.payout.id).toBe(payoutId)

        // Audit log contains create payout event
        const compliance = container.resolve("complianceModuleService") as any
        const logs = await compliance.listAuditLogs(
          { entity_type: "payout", entity_id: payoutId },
          { take: 50 }
        )
        expect(Array.isArray(logs)).toBe(true)
        expect(logs.find((l: any) => l.action === "create")).toBeTruthy()
      })

      it("rejects payout request when amount exceeds available balance", async () => {
        const container = getContainer()
        const business = await createTestBusiness(container)

        await createTestEarningEntry(container, "available", {
          business_id: business.id,
          type: "product_sale",
          gross_amount: 11000,
          platform_fee: 1000,
          payment_processing_fee: 0,
          net_amount: 10000,
        })

        const adminToken = signAdminToken("user_admin_fin_03", business.id)

        const res = await api
          .post(
            `/admin/payouts`,
            {
              business_id: business.id,
              amount: 20000,
              method: "ach",
              destination_account: "bank_test",
            },
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        if (res.status !== 400) {
          throw new Error(`Unexpected response: ${res.status} ${JSON.stringify(res.data)}`)
        }
        expect(res.status).toBe(400)
      })
    })
  },
})
