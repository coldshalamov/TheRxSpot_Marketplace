/**
 * Consult Gating Security Tests
 * 
 * Tests the consult gating middleware that enforces consultation
 * approval requirements before allowing cart operations.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { consultGatingMiddleware } from "../../api/middlewares/consult-gating"
import { 
  createMockRequest, 
  createMockResponse, 
  createMockNext,
  getServices,
} from "../utils/test-server"
import {
  createTestBusiness,
  createTestCustomer,
  createTestProduct,
  createTestConsultApproval,
  createTestConsultation,
  createTestPatient,
} from "../utils/factories"
import { dateOffset } from "../utils/test-server"

jest.setTimeout(60000)

describe("Consult Gating Security", () => {
  describe("API Integration Tests", () => {
    it("should REJECT adding consult-required product without approval", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ api, container }) => {
          // Arrange: Create test data
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const product = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })
          
          // Create a cart for the customer
          const cartResponse = await api.post("/store/carts", {
            customer_id: customer.id,
            metadata: { business_id: business.id },
          })
          const cartId = cartResponse.data.cart.id
          
          // Act: Try to add consult-required product without approval
          const response = await api.post(
            `/store/carts/${cartId}/line-items`,
            { product_id: product.id, quantity: 1 },
            { headers: { Authorization: `Bearer customer_${customer.id}` } }
          ).catch(err => err.response)
          
          // Assert: Should be rejected with CONSULT_REQUIRED
          expect(response.status).toBe(403)
          expect(response.data).toMatchObject({
            code: "CONSULT_REQUIRED",
            product_id: product.id,
          })
        },
      })
    })

    it("should ALLOW adding consult-required product WITH approval", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ api, container }) => {
          // Arrange: Create test data with approval
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const product = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })
          
          // Create valid consultation approval
          await createTestConsultApproval(container, "approved", {
            customer_id: customer.id,
            product_id: product.id,
            business_id: business.id,
            expires_at: dateOffset(30), // Valid for 30 days
          })
          
          // Create cart
          const cartResponse = await api.post("/store/carts", {
            customer_id: customer.id,
            metadata: { business_id: business.id },
          })
          const cartId = cartResponse.data.cart.id
          
          // Act: Add product with valid approval
          const response = await api.post(
            `/store/carts/${cartId}/line-items`,
            { product_id: product.id, quantity: 1 },
            { headers: { Authorization: `Bearer customer_${customer.id}` } }
          )
          
          // Assert: Should succeed
          expect(response.status).toBe(200)
          expect(response.data.cart).toBeDefined()
          expect(response.data.cart.items).toHaveLength(1)
          expect(response.data.cart.items[0].product_id).toBe(product.id)
        },
      })
    })

    it("should REJECT expired consult approvals", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ api, container }) => {
          // Arrange: Create expired approval
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const product = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })
          
          // Create expired consultation approval
          await createTestConsultApproval(container, "approved", {
            customer_id: customer.id,
            product_id: product.id,
            business_id: business.id,
            expires_at: dateOffset(-1), // Expired yesterday
          })
          
          // Create cart
          const cartResponse = await api.post("/store/carts", {
            customer_id: customer.id,
            metadata: { business_id: business.id },
          })
          const cartId = cartResponse.data.cart.id
          
          // Act: Try to add product with expired approval
          const response = await api.post(
            `/store/carts/${cartId}/line-items`,
            { product_id: product.id, quantity: 1 },
            { headers: { Authorization: `Bearer customer_${customer.id}` } }
          ).catch(err => err.response)
          
          // Assert: Should be rejected
          expect(response.status).toBe(403)
          expect(response.data.code).toBe("CONSULT_REQUIRED")
        },
      })
    })

    it("should REJECT rejected consult approvals", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ api, container }) => {
          // Arrange: Create rejected approval
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const product = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })
          
          // Create rejected consultation approval
          await createTestConsultApproval(container, "rejected", {
            customer_id: customer.id,
            product_id: product.id,
            business_id: business.id,
          })
          
          // Create cart
          const cartResponse = await api.post("/store/carts", {
            customer_id: customer.id,
            metadata: { business_id: business.id },
          })
          const cartId = cartResponse.data.cart.id
          
          // Act: Try to add product with rejected approval
          const response = await api.post(
            `/store/carts/${cartId}/line-items`,
            { product_id: product.id, quantity: 1 },
            { headers: { Authorization: `Bearer customer_${customer.id}` } }
          ).catch(err => err.response)
          
          // Assert: Should be rejected
          expect(response.status).toBe(403)
          expect(response.data.code).toBe("CONSULT_REQUIRED")
        },
      })
    })

    it("should ALLOW non-consult products without approval", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ api, container }) => {
          // Arrange: Create regular product (no consult required)
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const product = await createTestProduct(container, false, {
            metadata: { requires_consult: false },
          })
          
          // Create cart
          const cartResponse = await api.post("/store/carts", {
            customer_id: customer.id,
            metadata: { business_id: business.id },
          })
          const cartId = cartResponse.data.cart.id
          
          // Act: Add regular product without approval
          const response = await api.post(
            `/store/carts/${cartId}/line-items`,
            { product_id: product.id, quantity: 1 },
            { headers: { Authorization: `Bearer customer_${customer.id}` } }
          )
          
          // Assert: Should succeed without approval
          expect(response.status).toBe(200)
          expect(response.data.cart.items).toHaveLength(1)
        },
      })
    })

    it("should validate approval matches product_id", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ api, container }) => {
          // Arrange: Create two different products
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const productA = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })
          const productB = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })
          
          // Create approval ONLY for product A
          await createTestConsultApproval(container, "approved", {
            customer_id: customer.id,
            product_id: productA.id,
            business_id: business.id,
            expires_at: dateOffset(30),
          })
          
          // Create cart
          const cartResponse = await api.post("/store/carts", {
            customer_id: customer.id,
            metadata: { business_id: business.id },
          })
          const cartId = cartResponse.data.cart.id
          
          // Act: Try to add product B using product A's approval
          const response = await api.post(
            `/store/carts/${cartId}/line-items`,
            { product_id: productB.id, quantity: 1 },
            { headers: { Authorization: `Bearer customer_${customer.id}` } }
          ).catch(err => err.response)
          
          // Assert: Should be rejected - approval doesn't match product
          expect(response.status).toBe(403)
          expect(response.data.code).toBe("CONSULT_REQUIRED")
        },
      })
    })

    it("should validate approval matches customer_id", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ api, container }) => {
          // Arrange: Create two different customers
          const business = await createTestBusiness(container)
          const customerA = await createTestCustomer(container, { email: "customer_a@test.com" })
          const customerB = await createTestCustomer(container, { email: "customer_b@test.com" })
          const product = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })
          
          // Create approval ONLY for customer A
          await createTestConsultApproval(container, "approved", {
            customer_id: customerA.id,
            product_id: product.id,
            business_id: business.id,
            expires_at: dateOffset(30),
          })
          
          // Create cart for customer B
          const cartResponse = await api.post("/store/carts", {
            customer_id: customerB.id,
            metadata: { business_id: business.id },
          })
          const cartId = cartResponse.data.cart.id
          
          // Act: Try to add product as customer B using customer A's approval
          const response = await api.post(
            `/store/carts/${cartId}/line-items`,
            { product_id: product.id, quantity: 1 },
            { headers: { Authorization: `Bearer customer_${customerB.id}` } }
          ).catch(err => err.response)
          
          // Assert: Should be rejected - approval belongs to different customer
          expect(response.status).toBe(403)
          expect(response.data.code).toBe("CONSULT_REQUIRED")
        },
      })
    })

    it("should handle batch item additions with mixed products", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ api, container }) => {
          // Arrange: Create mixed products
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const consultProduct = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })
          const regularProduct = await createTestProduct(container, false, {
            metadata: { requires_consult: false },
          })
          
          // Create approval only for consult product
          await createTestConsultApproval(container, "approved", {
            customer_id: customer.id,
            product_id: consultProduct.id,
            business_id: business.id,
            expires_at: dateOffset(30),
          })
          
          // Create cart
          const cartResponse = await api.post("/store/carts", {
            customer_id: customer.id,
            metadata: { business_id: business.id },
          })
          const cartId = cartResponse.data.cart.id
          
          // Act: Add both products in batch
          const response = await api.post(
            `/store/carts/${cartId}/line-items/batch`,
            {
              items: [
                { product_id: regularProduct.id, quantity: 1 },
                { product_id: consultProduct.id, quantity: 1 },
              ],
            },
            { headers: { Authorization: `Bearer customer_${customer.id}` } }
          )
          
          // Assert: Should succeed with both products
          expect(response.status).toBe(200)
          expect(response.data.cart.items).toHaveLength(2)
        },
      })
    })
  })

  describe("Middleware Unit Tests", () => {
    it("should skip non-POST requests", async () => {
      const req = createMockRequest({ method: "GET", path: "/line-items" })
      const res = createMockResponse()
      const next = createMockNext()
      
      await consultGatingMiddleware(req as any, res as any, next as any)
      
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it("should skip non-line-item paths", async () => {
      const req = createMockRequest({ method: "POST", path: "/products" })
      const res = createMockResponse()
      const next = createMockNext()
      
      await consultGatingMiddleware(req as any, res as any, next as any)
      
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })
  })
})
