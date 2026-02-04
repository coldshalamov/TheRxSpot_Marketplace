/**
 * Earnings Management Admin APIs (PLAN)
 *
 * Covers customizations required by the Earnings Management Page UI:
 * - GET /admin/earnings (list, filters, status/type mapping)
 * - GET /admin/earnings/summary (platform-wide allowed)
 * - GET /admin/earnings/export (CSV)
 * - GET /admin/payouts (list)
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
    describe("Earnings Management Admin APIs (PLAN)", () => {
      it("lists earnings with plan status/type mapping and supports CSV export", async () => {
        const container = getContainer()
        const b1 = await createTestBusiness(container)

        const e1 = await createTestEarningEntry(container, "available", {
          business_id: b1.id,
          order_id: "order_earn_01",
          type: "product_sale",
          gross_amount: 10000,
          platform_fee: 500,
          payment_processing_fee: 0,
          net_amount: 9500,
        })

        await createTestEarningEntry(container, "reversed", {
          business_id: b1.id,
          order_id: "order_earn_02",
          type: "shipping_fee",
          gross_amount: 1000,
          platform_fee: 0,
          payment_processing_fee: 0,
          net_amount: -1000,
        })

        const adminToken = signAdminToken("user_admin_earn_01", b1.id)

        const list = await api
          .get(`/admin/earnings?business_id=${b1.id}&status=completed&limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        if (list.status !== 200) {
          throw new Error(`Unexpected response: ${list.status} ${JSON.stringify(list.data)}`)
        }

        const ids = new Set((list.data.earnings || []).map((r: any) => r.id))
        expect(ids.has(e1.id)).toBe(true)

        const csv = await api
          .get(`/admin/earnings/export?business_id=${b1.id}&status=completed`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(csv.status).toBe(200)
        expect(String(csv.data).includes("earning_id")).toBe(true)
        expect(String(csv.data).includes(e1.id)).toBe(true)
      })

      it("allows platform-wide summary when no business_id is provided", async () => {
        const container = getContainer()
        const b1 = await createTestBusiness(container)

        await createTestEarningEntry(container, "available", {
          business_id: b1.id,
          type: "product_sale",
          gross_amount: 10000,
          platform_fee: 1000,
          payment_processing_fee: 0,
          net_amount: 9000,
        })

        const adminToken = signAdminToken("user_admin_earn_02")

        const res = await api
          .get(`/admin/earnings/summary`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        if (res.status !== 200) {
          throw new Error(`Unexpected response: ${res.status} ${JSON.stringify(res.data)}`)
        }

        expect(typeof res.data.total_earnings).toBe("number")
        expect(typeof res.data.platform_commission_balance).toBe("number")
        expect(typeof res.data.commission_pending).toBe("number")
      })
    })
  },
})

