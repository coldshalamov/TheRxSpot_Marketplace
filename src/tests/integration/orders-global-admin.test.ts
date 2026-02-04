/**
 * Orders Global Admin APIs (PLAN)
 *
 * Covers custom endpoints used by the Orders Page Expansion UI:
 * - GET /admin/custom/orders (list)
 * - GET /admin/custom/orders/:id (detail)
 * - POST /admin/custom/orders/:id/fulfillment (status transitions + tracking requirement)
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import jwt from "jsonwebtoken"
import { createTestBusiness, createTestCustomer, createTestEarningEntry, createTestOrder } from "../utils/factories"

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
    describe("Orders Global Admin APIs (PLAN)", () => {
      it("lists orders with filters and returns plan_status mapping", async () => {
        const container = getContainer()
        const business = await createTestBusiness(container)
        const customer = await createTestCustomer(container)

        const o1 = await createTestOrder(container, "pending", {
          business_id: business.id,
          customer_id: customer.id,
          total: 12345,
          items: [{ title: "Finasteride 1mg", quantity: 1, unit_price: 10000, total: 10000 }],
          metadata: { fulfillment_status: "pending" },
        })

        const o2 = await createTestOrder(container, "processing", {
          business_id: business.id,
          customer_id: customer.id,
          total: 22222,
          items: [{ title: "Sildenafil", quantity: 1, unit_price: 20000, total: 20000 }],
          metadata: { fulfillment_status: "in_production" },
        })

        const adminToken = signAdminToken("user_admin_orders_01")

        const list = await api
          .get(`/admin/custom/orders?limit=25&offset=0&status=pending,in_production`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        if (list.status !== 200) {
          throw new Error(`Unexpected response: ${list.status} ${JSON.stringify(list.data)}`)
        }

        const ids = new Set((list.data.orders || []).map((o: any) => o.id))
        expect(ids.has(o1.id)).toBe(true)
        expect(ids.has(o2.id)).toBe(true)

        const row = (list.data.orders || []).find((o: any) => o.id === o2.id)
        expect(row.plan_status).toBe("in_production")
      })

      it("enforces shipped tracking_number and updates earnings when delivered", async () => {
        const container = getContainer()
        const business = await createTestBusiness(container)
        const customer = await createTestCustomer(container)

        const order = await createTestOrder(container, "pending", {
          business_id: business.id,
          customer_id: customer.id,
          total: 10000,
          items: [{ title: "Tadalafil", quantity: 1, unit_price: 10000, total: 10000 }],
          metadata: { fulfillment_status: "in_production" },
        })

        const earning = await createTestEarningEntry(container, "pending", {
          business_id: business.id,
          order_id: order.id,
          type: "product_sale",
          gross_amount: 10000,
          platform_fee: 1000,
          payment_processing_fee: 0,
          net_amount: 9000,
        })

        const adminToken = signAdminToken("user_admin_orders_02")

        // Mark shipped without tracking -> 400
        const shipFail = await api
          .post(
            `/admin/custom/orders/${order.id}/fulfillment`,
            { status: "shipped" },
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        expect(shipFail.status).toBe(400)

        // Mark shipped with tracking -> 200
        const shipOk = await api
          .post(
            `/admin/custom/orders/${order.id}/fulfillment`,
            { status: "shipped", tracking_number: "1Z999" },
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        if (shipOk.status !== 200) {
          throw new Error(`Unexpected response: ${shipOk.status} ${JSON.stringify(shipOk.data)}`)
        }

        expect(shipOk.data.order?.metadata?.tracking_number).toBe("1Z999")
        expect(shipOk.data.plan_status).toBe("shipped")

        // Delivered triggers earnings availability
        const deliverOk = await api
          .post(
            `/admin/custom/orders/${order.id}/fulfillment`,
            { status: "delivered" },
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        if (deliverOk.status !== 200) {
          throw new Error(`Unexpected response: ${deliverOk.status} ${JSON.stringify(deliverOk.data)}`)
        }

        const financials = container.resolve("financialsModuleService") as any
        const updated = await financials.retrieveEarningEntry(earning.id)
        expect(updated.status === "available" || updated.status === "paid_out" || updated.status === "paid").toBe(true)
      })
    })
  },
})

