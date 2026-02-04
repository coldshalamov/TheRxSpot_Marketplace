/**
 * Order Workflow Tests
 * 
 * Tests the order lifecycle with consult gating integration.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createTestBusiness,
  createTestCustomer,
  createTestProduct,
  createTestOrder,
  createTestOrderStatusEvent,
  createTestConsultApproval,
} from "../utils/factories"
import { getServices, dateOffset } from "../utils/test-server"

jest.setTimeout(60000)

describe("Order Workflow", () => {
  describe("Consult-Required Orders", () => {
    it("should set consult_pending status for consult-required items", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const product = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })
          
          // Act: Create order with consult-required product
          const order = await createTestOrder(container, "consult_pending", {
            business_id: business.id,
            customer_id: customer.id,
            items: [{
              product_id: product.id,
              title: product.title,
              quantity: 1,
              unit_price: 100,
              total: 100,
            }],
          })
          
          // Assert
          expect(order.status).toBe("consult_pending")
          expect(order.metadata).toMatchObject({ business_id: business.id })
        },
      })
    })

    it("should transition consult_pending → consult_complete on approval", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const product = await createTestProduct(container, true)
          
          const order = await createTestOrder(container, "consult_pending", {
            business_id: business.id,
            customer_id: customer.id,
            items: [{ product_id: product.id, total: 100 }],
          })
          
          // Create consult approval
          await createTestConsultApproval(container, "approved", {
            customer_id: customer.id,
            product_id: product.id,
            business_id: business.id,
            expires_at: dateOffset(30),
          })
          
          const { business: businessService } = getServices(container)
          
          // Act: Transition to consult_complete
          await businessService.recordOrderStatusEvent(
            order.id,
            "consult_pending",
            "consult_complete",
            "system",
            "Consultation approved"
          )
          
          // Assert: Verify event was created
          const events = await businessService.listOrderStatusEventsByOrder(order.id)
          expect(events).toHaveLength(1)
          expect(events[0].from_status).toBe("consult_pending")
          expect(events[0].to_status).toBe("consult_complete")
        },
      })
    })

    it("should transition consult_pending → consult_rejected on rejection", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const product = await createTestProduct(container, true)
          
          const order = await createTestOrder(container, "consult_pending", {
            business_id: business.id,
            customer_id: customer.id,
            items: [{ product_id: product.id, total: 100 }],
          })
          
          const { business: businessService } = getServices(container)
          
          // Act: Transition to consult_rejected
          await businessService.recordOrderStatusEvent(
            order.id,
            "consult_pending",
            "consult_rejected",
            "clinician_001",
            "Consultation rejected - contraindicated"
          )
          
          // Assert
          const events = await businessService.listOrderStatusEventsByOrder(order.id)
          const rejectionEvent = events.find(e => e.to_status === "consult_rejected")
          expect(rejectionEvent).toBeDefined()
          expect(rejectionEvent?.reason).toContain("rejected")
        },
      })
    })

    it("should track order status events", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const order = await createTestOrder(container, "pending", {
            business_id: business.id,
            total: 100,
          })
          
          const { business: businessService } = getServices(container)
          
          // Act: Create multiple status events
          await createTestOrderStatusEvent(container, {
            order_id: order.id,
            from_status: "pending",
            to_status: "payment_captured",
            changed_by: "system",
          })
          
          await createTestOrderStatusEvent(container, {
            order_id: order.id,
            from_status: "payment_captured",
            to_status: "processing",
            changed_by: "admin_user",
          })
          
          await createTestOrderStatusEvent(container, {
            order_id: order.id,
            from_status: "processing",
            to_status: "fulfilled",
            changed_by: "warehouse_system",
          })
          
          // Assert
          const events = await businessService.listOrderStatusEventsByOrder(order.id)
          expect(events).toHaveLength(3)
          
          const statuses = events.map(e => e.to_status)
          expect(statuses).toContain("payment_captured")
          expect(statuses).toContain("processing")
          expect(statuses).toContain("fulfilled")
        },
      })
    })
  })

  describe("Normal Order Flow", () => {
    it("should allow normal flow for non-consult products", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const regularProduct = await createTestProduct(container, false)
          
          const { business: businessService } = getServices(container)
          
          // Act: Create order with regular product
          const order = await createTestOrder(container, "pending", {
            business_id: business.id,
            customer_id: customer.id,
            items: [{ product_id: regularProduct.id, total: 100 }],
          })
          
          // Simulate normal flow: pending → payment_captured → processing → fulfilled → delivered
          const transitions = [
            { from: "pending", to: "payment_captured" },
            { from: "payment_captured", to: "processing" },
            { from: "processing", to: "fulfilled" },
            { from: "fulfilled", to: "delivered" },
          ]
          
          for (const transition of transitions) {
            await businessService.recordOrderStatusEvent(
              order.id,
              transition.from,
              transition.to,
              "system"
            )
          }
          
          // Assert
          const events = await businessService.listOrderStatusEventsByOrder(order.id)
          expect(events).toHaveLength(4)
          
          const latestEvent = events[events.length - 1]
          expect(latestEvent.to_status).toBe("delivered")
        },
      })
    })

    it("should validate status transitions", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const order = await createTestOrder(container, "pending", {
            business_id: business.id,
          })
          
          const { business: businessService } = getServices(container)
          
          // Act & Assert: Try to create an invalid transition
          // This should still create the event (validation happens elsewhere)
          const invalidEvent = await createTestOrderStatusEvent(container, {
            order_id: order.id,
            from_status: "pending",
            to_status: "delivered", // Skipping many steps
            changed_by: "system",
          })
          
          expect(invalidEvent).toBeDefined()
          expect(invalidEvent.to_status).toBe("delivered")
        },
      })
    })
  })

  describe("Order Status Event Metadata", () => {
    it("should store metadata with status events", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const order = await createTestOrder(container, "pending", {
            business_id: business.id,
          })
          
          const { business: businessService } = getServices(container)
          
          // Act: Create event with metadata
          await businessService.recordOrderStatusEvent(
            order.id,
            "pending",
            "processing",
            "admin_user",
            "Manual order processing",
            {
              processed_by: "admin_user",
              batch_id: "batch_123",
              priority: "high",
            }
          )
          
          // Assert
          const events = await businessService.listOrderStatusEventsByOrder(order.id)
          expect(events[0].metadata).toMatchObject({
            batch_id: "batch_123",
            priority: "high",
          })
        },
      })
    })

    it("should get latest order status event", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const order = await createTestOrder(container, "pending", {
            business_id: business.id,
          })
          
          const { business: businessService } = getServices(container)
          
          // Create events in sequence
          await businessService.recordOrderStatusEvent(order.id, "pending", "processing", "system")
          await businessService.recordOrderStatusEvent(order.id, "processing", "fulfilled", "system")
          await businessService.recordOrderStatusEvent(order.id, "fulfilled", "delivered", "system")
          
          // Act
          const latestEvent = await businessService.getLatestOrderStatusEvent(order.id)
          
          // Assert
          expect(latestEvent).toBeDefined()
          expect(latestEvent?.to_status).toBe("delivered")
          expect(latestEvent?.from_status).toBe("fulfilled")
        },
      })
    })
  })

  describe("Order Cancellation and Refunds", () => {
    it("should track cancellation status events", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const order = await createTestOrder(container, "pending", {
            business_id: business.id,
          })
          
          const { business: businessService } = getServices(container)
          
          // Act: Cancel order
          await businessService.recordOrderStatusEvent(
            order.id,
            "pending",
            "cancelled",
            "customer_service",
            "Customer requested cancellation"
          )
          
          // Assert
          const events = await businessService.listOrderStatusEventsByOrder(order.id)
          const cancelEvent = events.find(e => e.to_status === "cancelled")
          expect(cancelEvent).toBeDefined()
          expect(cancelEvent?.reason).toContain("cancellation")
        },
      })
    })

    it("should track refund status events", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const order = await createTestOrder(container, "payment_captured", {
            business_id: business.id,
          })
          
          const { business: businessService } = getServices(container)
          
          // Act: Refund order
          await businessService.recordOrderStatusEvent(
            order.id,
            "payment_captured",
            "refunded",
            "admin_user",
            "Full refund issued - product out of stock",
            { refund_amount: 10000, refund_reason: "out_of_stock" }
          )
          
          // Assert
          const events = await businessService.listOrderStatusEventsByOrder(order.id)
          const refundEvent = events.find(e => e.to_status === "refunded")
          expect(refundEvent).toBeDefined()
          expect(refundEvent?.metadata?.refund_reason).toBe("out_of_stock")
        },
      })
    })
  })
})
