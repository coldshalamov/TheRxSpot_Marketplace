/**
 * Earnings Calculation Tests
 * 
 * Tests the financial calculations for platform fees, payment processing,
 * and earnings distribution.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createTestBusiness,
  createTestCustomer,
  createTestOrder,
  createTestEarningEntry,
  createTestPayout,
  createTestClinician,
} from "../utils/factories"
import { getServices } from "../utils/test-server"

jest.setTimeout(60000)

describe("Earnings Calculation", () => {
  describe("Platform Fee Calculations", () => {
    it("should calculate correct platform fee (10%)", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const { financials } = getServices(container)
          
          // Act: Calculate earnings for $100 order
          const order = {
            id: "order_001",
            business_id: business.id,
            items: [{
              id: "item_001",
              title: "Test Product",
              quantity: 1,
              unit_price: 100,
              total: 100,
            }],
            currency_code: "usd",
          }
          
          const earnings = await financials.calculateEarningsOnOrder(order)
          
          // Assert: 10% of $100 = $10 = 1000 cents
          expect(earnings).toHaveLength(1)
          expect(Number(earnings[0].platform_fee)).toBe(1000)
        },
      })
    })

    it("should calculate payment processing fee (2.9% + $0.30)", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const { financials } = getServices(container)
          
          // Act: Calculate earnings for $100 order
          const order = {
            id: "order_002",
            business_id: business.id,
            items: [{
              id: "item_002",
              title: "Test Product",
              quantity: 1,
              unit_price: 100,
              total: 100,
            }],
            currency_code: "usd",
          }
          
          const earnings = await financials.calculateEarningsOnOrder(order)
          
          // Assert: 2.9% of $100 + $0.30 = $2.90 + $0.30 = $3.20 = 320 cents
          expect(earnings).toHaveLength(1)
          expect(Number(earnings[0].payment_processing_fee)).toBeCloseTo(320, 0)
        },
      })
    })

    it("should calculate net amount correctly", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const { financials } = getServices(container)
          
          // Act: Calculate earnings for $100 order
          const order = {
            id: "order_003",
            business_id: business.id,
            items: [{
              id: "item_003",
              title: "Test Product",
              quantity: 1,
              unit_price: 100,
              total: 100,
            }],
            currency_code: "usd",
          }
          
          const earnings = await financials.calculateEarningsOnOrder(order)
          
          // Assert: net = gross - platform_fee - processing_fee
          // $100 - $10 - $3.20 = $86.80 = 8680 cents
          const grossAmount = Number(earnings[0].gross_amount)
          const platformFee = Number(earnings[0].platform_fee)
          const processingFee = Number(earnings[0].payment_processing_fee)
          const netAmount = Number(earnings[0].net_amount)
          
          expect(grossAmount).toBe(10000)
          expect(netAmount).toBe(grossAmount - platformFee - processingFee)
          expect(netAmount).toBeCloseTo(8680, 0)
        },
      })
    })

    it("should handle multiple line items", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const { financials } = getServices(container)
          
          // Act: Calculate earnings for order with multiple items
          const order = {
            id: "order_multi",
            business_id: business.id,
            items: [
              { id: "item_1", title: "Product 1", quantity: 1, unit_price: 50, total: 50 },
              { id: "item_2", title: "Product 2", quantity: 2, unit_price: 25, total: 50 },
            ],
            currency_code: "usd",
          }
          
          const earnings = await financials.calculateEarningsOnOrder(order)
          
          // Assert: Should have 2 earning entries
          expect(earnings).toHaveLength(2)
          
          // Check first item
          expect(Number(earnings[0].gross_amount)).toBe(5000) // $50
          expect(Number(earnings[0].platform_fee)).toBe(500) // 10% of $50
          
          // Check second item
          expect(Number(earnings[1].gross_amount)).toBe(5000) // $50
          expect(Number(earnings[1].platform_fee)).toBe(500) // 10% of $50
        },
      })
    })

    it("should calculate shipping fee earnings", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const { financials } = getServices(container)
          
          // Act: Calculate earnings with shipping
          const order = {
            id: "order_shipping",
            business_id: business.id,
            items: [{
              id: "item_ship",
              title: "Product",
              quantity: 1,
              unit_price: 100,
              total: 100,
            }],
            shipping_total: 15,
            currency_code: "usd",
          }
          
          const earnings = await financials.calculateEarningsOnOrder(order)
          
          // Assert: Should have 2 entries (product + shipping)
          expect(earnings).toHaveLength(2)
          
          // Find shipping entry
          const shippingEntry = earnings.find(e => e.type === "shipping_fee")
          expect(shippingEntry).toBeDefined()
          expect(Number(shippingEntry?.gross_amount)).toBe(1500) // $15
          expect(Number(shippingEntry?.platform_fee)).toBe(150) // 10% of $15
        },
      })
    })
  })

  describe("Earnings Status Lifecycle", () => {
    it("should set earnings status to pending on order creation", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange & Act
          const business = await createTestBusiness(container)
          const earning = await createTestEarningEntry(container, "pending", {
            business_id: business.id,
            order_id: "order_001",
            gross_amount: 10000,
          })
          
          // Assert
          expect(earning.status).toBe("pending")
          expect(earning.available_at).toBeNull()
        },
      })
    })

    it("should set earnings status to available on order delivery", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const order = await createTestOrder(container, "delivered", {
            business_id: business.id,
          })
          const earning = await createTestEarningEntry(container, "pending", {
            business_id: business.id,
            order_id: order.id,
          })
          
          const { financials } = getServices(container)
          
          // Act: Make earnings available
          await financials.makeEarningsAvailable(order.id)
          
          // Assert
          const updatedEarning = await financials.retrieveEarningEntry(earning.id)
          expect(updatedEarning.status).toBe("available")
          expect(updatedEarning.available_at).toBeDefined()
        },
      })
    })

    it("should cancel earnings on order cancellation", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const order = await createTestOrder(container, "cancelled", {
            business_id: business.id,
          })
          const earning = await createTestEarningEntry(container, "pending", {
            business_id: business.id,
            order_id: order.id,
          })
          
          const { financials } = getServices(container)
          
          // Act: Cancel earnings
          await financials.cancelEarnings(order.id)
          
          // Assert
          const updatedEarning = await financials.retrieveEarningEntry(earning.id)
          expect(updatedEarning.status).toBe("reversed")
        },
      })
    })

    it("should not reverse already paid earnings", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const order = await createTestOrder(container, "cancelled", {
            business_id: business.id,
          })
          const paidEarning = await createTestEarningEntry(container, "paid", {
            business_id: business.id,
            order_id: order.id,
            paid_at: new Date(),
          })
          
          const { financials } = getServices(container)
          
          // Act: Try to cancel (should not affect paid earnings)
          await financials.cancelEarnings(order.id)
          
          // Assert
          const updatedEarning = await financials.retrieveEarningEntry(paidEarning.id)
          expect(updatedEarning.status).toBe("paid") // Should remain paid
        },
      })
    })
  })

  describe("Consultation Fee Earnings", () => {
    it("should create consultation fee earnings", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const clinician = await createTestClinician(container, { business_id: business.id })
          const { financials } = getServices(container)
          
          // Act: Calculate consultation earnings
          const consultation = {
            id: "consult_001",
            business_id: business.id,
            clinician_id: clinician.id,
            fee: 50, // $50 consultation fee
            currency_code: "usd",
          }
          
          const earnings = await financials.calculateConsultationEarnings(consultation)
          
          // Assert: Should create 2 entries (clinician + business)
          expect(earnings).toHaveLength(2)
          
          const clinicianEarning = earnings.find(e => e.type === "clinician_fee")
          const businessEarning = earnings.find(e => e.type === "consultation_fee")
          
          expect(clinicianEarning).toBeDefined()
          expect(businessEarning).toBeDefined()
        },
      })
    })

    it("should split consultation fees correctly (70% clinician, 30% business)", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const clinician = await createTestClinician(container, { business_id: business.id })
          const { financials } = getServices(container)
          
          // Act: Calculate for $50 consultation fee
          // Platform takes 10% ($5), leaving $45
          // Clinician gets 70% of $45 = $31.50
          // Business gets 30% of $45 = $13.50
          const consultation = {
            id: "consult_002",
            business_id: business.id,
            clinician_id: clinician.id,
            fee: 50,
            currency_code: "usd",
          }
          
          const earnings = await financials.calculateConsultationEarnings(consultation)
          
          // Assert
          const clinicianEarning = earnings.find(e => e.type === "clinician_fee")
          const businessEarning = earnings.find(e => e.type === "consultation_fee")
          
          // Platform fee: 10% of $50 = $5 = 500 cents
          expect(Number(businessEarning?.platform_fee)).toBe(500)
          
          // Remaining after platform fee: $50 - $5 = $45 = 4500 cents
          // Clinician gets 70%: $31.50 = 3150 cents
          // Business gets 30%: $13.50 = 1350 cents
          expect(Number(clinicianEarning?.gross_amount)).toBeCloseTo(3150, 0)
          expect(Number(businessEarning?.gross_amount)).toBeCloseTo(1350, 0)
        },
      })
    })

    it("should handle consultation without clinician", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const { financials } = getServices(container)
          
          // Act: Calculate earnings for consultation without clinician
          const consultation = {
            id: "consult_003",
            business_id: business.id,
            clinician_id: undefined, // No clinician
            fee: 50,
            currency_code: "usd",
          }
          
          const earnings = await financials.calculateConsultationEarnings(consultation)
          
          // Assert: Should only create business earning (no clinician fee)
          expect(earnings).toHaveLength(1)
          expect(earnings[0].type).toBe("consultation_fee")
          expect(earnings[0].clinician_fee).toBeNull()
        },
      })
    })
  })

  describe("Earnings Summary", () => {
    it("should calculate earnings summary correctly", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          
          // Create available earnings
          await createTestEarningEntry(container, "available", {
            business_id: business.id,
            net_amount: 5000, // $50
          })
          await createTestEarningEntry(container, "available", {
            business_id: business.id,
            net_amount: 3000, // $30
          })
          
          // Create pending earnings
          await createTestEarningEntry(container, "pending", {
            business_id: business.id,
            net_amount: 2000, // $20
          })
          
          // Create paid earnings (counts toward lifetime)
          await createTestEarningEntry(container, "paid", {
            business_id: business.id,
            net_amount: 10000, // $100
          })
          
          const { financials } = getServices(container)
          
          // Act
          const summary = await financials.getEarningsSummary(business.id)
          
          // Assert
          expect(summary.available).toBe(8000) // $50 + $30
          expect(summary.pending).toBe(2000) // $20
          expect(summary.lifetime).toBe(20000) // $50 + $30 + $20 + $100
        },
      })
    })

    it("should calculate next payout date when earnings available", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          await createTestEarningEntry(container, "available", {
            business_id: business.id,
            net_amount: 5000,
          })
          
          const { financials } = getServices(container)
          
          // Act
          const summary = await financials.getEarningsSummary(business.id)
          
          // Assert
          expect(summary.next_payout_date).toBeDefined()
          expect(summary.next_payout_date instanceof Date).toBe(true)
        },
      })
    })

    it("should not set next payout date when no earnings available", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          await createTestEarningEntry(container, "pending", {
            business_id: business.id,
            net_amount: 5000,
          })
          
          const { financials } = getServices(container)
          
          // Act
          const summary = await financials.getEarningsSummary(business.id)
          
          // Assert
          expect(summary.next_payout_date).toBeNull()
        },
      })
    })
  })

  describe("Payout Processing", () => {
    it("should aggregate earnings into payout correctly", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          
          const earning1 = await createTestEarningEntry(container, "available", {
            business_id: business.id,
            gross_amount: 10000,
            platform_fee: 1000,
            payment_processing_fee: 320,
            net_amount: 8680,
          })
          
          const earning2 = await createTestEarningEntry(container, "available", {
            business_id: business.id,
            gross_amount: 5000,
            platform_fee: 500,
            payment_processing_fee: 175,
            net_amount: 4325,
          })
          
          const { financials } = getServices(container)
          
          // Act: Create payout
          const payout = await financials.createPayout(
            business.id,
            [earning1.id, earning2.id],
            "admin_user"
          )
          
          // Assert
          expect(payout.business_id).toBe(business.id)
          expect(Number(payout.total_amount)).toBe(15000) // $100 + $50
          expect(Number(payout.fee_amount)).toBe(1995) // $10 + $0.32 + $5 + $1.75
          expect(Number(payout.net_amount)).toBe(13005) // $86.80 + $43.25
          expect(payout.status).toBe("pending")
        },
      })
    })

    it("should reject payout with non-available earnings", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const pendingEarning = await createTestEarningEntry(container, "pending", {
            business_id: business.id,
          })
          
          const { financials } = getServices(container)
          
          // Act & Assert
          await expect(
            financials.createPayout(business.id, [pendingEarning.id])
          ).rejects.toThrow(/is not available for payout/)
        },
      })
    })

    it("should reject payout with earnings from different business", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business1 = await createTestBusiness(container)
          const business2 = await createTestBusiness(container)
          
          const earning = await createTestEarningEntry(container, "available", {
            business_id: business1.id,
          })
          
          const { financials } = getServices(container)
          
          // Act & Assert: Try to payout business1's earning from business2
          await expect(
            financials.createPayout(business2.id, [earning.id])
          ).rejects.toThrow(/does not belong to business/)
        },
      })
    })

    it("should process payout and update earnings status", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const earning = await createTestEarningEntry(container, "available", {
            business_id: business.id,
            payout_id: null,
          })
          
          const { financials } = getServices(container)
          const payout = await financials.createPayout(business.id, [earning.id])
          
          // Act: Process the payout
          const processedPayout = await financials.processPayout(payout.id, "admin_user")
          
          // Assert
          expect(processedPayout.status).toBe("completed")
          expect(processedPayout.completed_at).toBeDefined()
          
          // Check earning was updated
          const updatedEarning = await financials.retrieveEarningEntry(earning.id)
          expect(updatedEarning.status).toBe("paid")
          expect(updatedEarning.paid_at).toBeDefined()
        },
      })
    })

    it("should cancel payout and revert earnings to available", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const earning = await createTestEarningEntry(container, "available", {
            business_id: business.id,
          })
          
          const { financials } = getServices(container)
          const payout = await financials.createPayout(business.id, [earning.id])
          
          // Verify earning was linked and status changed to pending
          let linkedEarning = await financials.retrieveEarningEntry(earning.id)
          expect(linkedEarning.payout_id).toBe(payout.id)
          expect(linkedEarning.status).toBe("pending")
          
          // Act: Cancel the payout
          const cancelledPayout = await financials.cancelPayout(
            payout.id,
            "Cancelled by admin"
          )
          
          // Assert
          expect(cancelledPayout.status).toBe("failed")
          expect(cancelledPayout.failure_reason).toBe("Cancelled by admin")
          
          // Check earning was reverted
          linkedEarning = await financials.retrieveEarningEntry(earning.id)
          expect(linkedEarning.status).toBe("available")
          expect(linkedEarning.payout_id).toBeNull()
        },
      })
    })

    it("should reject processing already processed payout", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const earning = await createTestEarningEntry(container, "available", {
            business_id: business.id,
          })
          
          const { financials } = getServices(container)
          const payout = await financials.createPayout(business.id, [earning.id])
          await financials.processPayout(payout.id)
          
          // Act & Assert: Try to process again
          await expect(
            financials.processPayout(payout.id)
          ).rejects.toThrow(/cannot be processed/)
        },
      })
    })
  })

  describe("Platform Analytics", () => {
    it("should calculate platform-wide earnings summary", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business1 = await createTestBusiness(container)
          const business2 = await createTestBusiness(container)
          
          // Create earnings for both businesses
          await createTestEarningEntry(container, "available", {
            business_id: business1.id,
            gross_amount: 10000,
            platform_fee: 1000,
            net_amount: 8680,
          })
          await createTestEarningEntry(container, "paid", {
            business_id: business2.id,
            gross_amount: 5000,
            platform_fee: 500,
            net_amount: 4325,
          })
          
          // Create payouts
          await createTestPayout(container, "completed", {
            business_id: business1.id,
            net_amount: 5000,
          })
          await createTestPayout(container, "pending", {
            business_id: business2.id,
            net_amount: 3000,
          })
          
          const { financials } = getServices(container)
          
          // Act
          const summary = await financials.getPlatformEarningsSummary()
          
          // Assert
          expect(summary.total_gross).toBe(15000) // $100 + $50
          expect(summary.total_platform_fees).toBe(1500) // $10 + $5
          expect(summary.total_paid_out).toBe(5000) // Only completed payout
          expect(summary.pending_payouts).toBe(3000) // Pending payout
        },
      })
    })

    it("should calculate earnings by period", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          
          // Create earnings for current month
          await createTestEarningEntry(container, "available", {
            business_id: business.id,
            gross_amount: 10000,
            net_amount: 8680,
          })
          
          const { financials } = getServices(container)
          
          // Act: Get earnings by month
          const earningsByMonth = await financials.getEarningsByPeriod("month")
          
          // Assert
          expect(earningsByMonth.length).toBeGreaterThan(0)
          expect(earningsByMonth[0].gross).toBeGreaterThan(0)
          expect(earningsByMonth[0].net).toBeGreaterThan(0)
        },
      })
    })
  })
})
