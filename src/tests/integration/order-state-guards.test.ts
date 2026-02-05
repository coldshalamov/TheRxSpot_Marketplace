/**
 * Week 2 Bridge: Order state integrity
 *
 * Ensures it is impossible to move an order into the fulfillment pipeline
 * unless consultation approvals exist (when required).
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { orderStatusTransitionWorkflow } from "../../workflows/order-lifecycle"
import {
  createTestBusiness,
  createTestCustomer,
  createTestOrder,
  createTestProduct,
  createTestConsultApproval,
} from "../utils/factories"
import { dateOffset } from "../utils/test-server"
import { assertConsultApprovedForFulfillment } from "../../utils/order-consult-guard"
import { runWorkflowOrThrow } from "../../utils/workflow"

jest.setTimeout(60000)

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("Order state guards", () => {
      it("blocks transition to processing when consult approvals are missing", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container)
        const customer = await createTestCustomer(container)
        const product = await createTestProduct(container, true, {
          metadata: { requires_consult: true },
        })

        const order = await createTestOrder(container, "payment_captured", {
          business_id: business.id,
          customer_id: customer.id,
          items: [{ product_id: product.id, quantity: 1, unit_price: 1000, total: 1000 }],
          metadata: {
            requires_consultation: true,
            consult_required_product_ids: [product.id],
          },
        })

        const orderService = (container as any).resolve(Modules.ORDER)
        const fetched = await orderService.retrieveOrder(order.id, { relations: ["items"] })
        if (!Array.isArray(fetched.items) || fetched.items.length === 0) {
          throw new Error(
            `Test setup error: order has no items. metadata=${JSON.stringify(fetched.metadata ?? null)}`
          )
        }
        if ((fetched as any).customer_id !== customer.id) {
          throw new Error(
            `Test setup error: order.customer_id mismatch. expected=${customer.id} got=${JSON.stringify(
              (fetched as any).customer_id ?? null
            )}`
          )
        }
        if ((fetched.metadata as any)?.business_id !== business.id) {
          throw new Error(
            `Test setup error: order.metadata.business_id mismatch. expected=${business.id} got=${JSON.stringify(
              (fetched.metadata as any)?.business_id ?? null
            )} metadata=${JSON.stringify(fetched.metadata ?? null)}`
          )
        }
        const consultIds = (fetched.metadata as any)?.consult_required_product_ids
        if (!Array.isArray(consultIds) || !consultIds.includes(product.id)) {
          throw new Error(
            `Test setup error: consult_required_product_ids not persisted/visible. consult_required_product_ids=${JSON.stringify(
              consultIds ?? null
            )} metadata=${JSON.stringify(fetched.metadata ?? null)}`
          )
        }
        if ((fetched.metadata as any)?.requires_consultation !== true) {
          throw new Error(
            `Test setup error: requires_consultation not persisted/visible. requires_consultation=${JSON.stringify(
              (fetched.metadata as any)?.requires_consultation ?? null
            )} metadata=${JSON.stringify(fetched.metadata ?? null)}`
          )
        }

        const businessService = (container as any).resolve("businessModuleService")
        const existingApproved = await businessService.listConsultApprovals(
          {
            business_id: business.id,
            customer_id: customer.id,
            product_id: product.id,
            status: "approved",
          },
          { take: 10 }
        )
        if (existingApproved.length > 0) {
          throw new Error(
            `Test setup error: found pre-existing approved consult approval(s): ${JSON.stringify(
              existingApproved.map((a: any) => ({
                id: a.id,
                status: a.status,
                expires_at: a.expires_at ?? null,
                approved_at: a.approved_at ?? null,
              }))
            )}`
          )
        }

        await expect(
          assertConsultApprovedForFulfillment(container as any, fetched)
        ).rejects.toThrow(/CONSULT_APPROVAL_REQUIRED_FOR_FULFILLMENT/)

        const fetchedAgain = await orderService.retrieveOrder(order.id, { relations: ["items"] })
        await expect(
          assertConsultApprovedForFulfillment(container as any, fetchedAgain)
        ).rejects.toThrow(/CONSULT_APPROVAL_REQUIRED_FOR_FULFILLMENT/)

        let invalidTransitionError: any = null
        try {
          await runWorkflowOrThrow(orderStatusTransitionWorkflow(container as any), {
            input: {
              orderId: order.id,
              fromStatus: "payment_captured",
              toStatus: "delivered", // invalid jump
              changedBy: "itest",
              reason: "sanity: invalid transition should throw",
            },
          })
        } catch (e) {
          invalidTransitionError = e
        }

        expect(invalidTransitionError).toBeTruthy()
        expect(String(invalidTransitionError?.message ?? invalidTransitionError)).toMatch(/Invalid status transition/)

        await expect(
          runWorkflowOrThrow(orderStatusTransitionWorkflow(container as any), {
            input: {
              orderId: order.id,
              fromStatus: "payment_captured",
              toStatus: "processing",
              changedBy: "itest",
              reason: "attempt fulfillment without consult approval",
            },
          })
        ).rejects.toThrow(/CONSULT_APPROVAL_REQUIRED_FOR_FULFILLMENT/)

        await createTestConsultApproval(container, "approved", {
          customer_id: customer.id,
          product_id: product.id,
          business_id: business.id,
          consultation_id: "consult_guard_001",
          approved_at: dateOffset(-1),
          expires_at: dateOffset(30),
        })

        await expect(
          runWorkflowOrThrow(orderStatusTransitionWorkflow(container as any), {
            input: {
              orderId: order.id,
              fromStatus: "payment_captured",
              toStatus: "processing",
              changedBy: "itest",
              reason: "fulfillment allowed with consult approval",
            },
          })
        ).resolves.toBeTruthy()

        const updated = await orderService.retrieveOrder(order.id)
        expect(updated.metadata.custom_status).toBe("processing")
      })
    })
  },
})
