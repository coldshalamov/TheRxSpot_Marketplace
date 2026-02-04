/**
 * Admin Dashboard Home Page API Tests (PLAN Week 3-4)
 *
 * Covers the backend summary endpoint used by the admin Home page:
 * - GET /admin/dashboard/home
 *
 * Verifies metrics + chart datasets are computed from real DB data.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import jwt from "jsonwebtoken"
import {
  createTestBusiness,
  createTestClinician,
  createTestConsultation,
  createTestEarningEntry,
  createTestOrder,
  createTestPatient,
} from "../utils/factories"

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

function isoDay(date: Date): string {
  return date.toISOString().split("T")[0]
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Admin dashboard home (PLAN)", () => {
      it("returns metrics, activity feed, and chart series", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container)
        const patient = await createTestPatient(container, { business_id: business.id })
        const clinician = await createTestClinician(container, { business_id: business.id })

        const now = new Date()

        await createTestConsultation(container, "scheduled" as any, {
          business_id: business.id,
          patient_id: patient.id,
          clinician_id: clinician.id,
          scheduled_at: now,
        })

        await createTestConsultation(container, "completed" as any, {
          business_id: business.id,
          patient_id: patient.id,
          clinician_id: clinician.id,
          ended_at: now,
          outcome: "pending",
        })

        await createTestEarningEntry(container, "available", {
          business_id: business.id,
          type: "product_sale",
          gross_amount: 10000,
          platform_fee: 1000,
          payment_processing_fee: 0,
          net_amount: 9000,
        })

        await createTestOrder(container, "processing" as any, { business_id: business.id })
        await createTestOrder(container, "fulfilled" as any, { business_id: business.id })

        const adminToken = signAdminToken("admin_dashboard_user_01")

        const res = await api
          .get(`/admin/dashboard/home`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        if (res.status !== 200) {
          throw new Error(
            `Unexpected response: ${res.status} ${JSON.stringify(res.data)}`
          )
        }

        expect(res.data).toHaveProperty("metrics")
        expect(res.data.metrics).toMatchObject({
          total_businesses: {
            value: 1,
            change_pct: null,
          },
          active_consultations: {
            value: 1,
          },
          pending_reviews: {
            value: 1,
          },
          orders_in_progress: {
            value: 2,
          },
          revenue_this_month: {
            gross_cents: 10000,
            platform_commission_cents: 1000,
          },
        })

        expect(Array.isArray(res.data.activity?.logs)).toBe(true)
        expect(res.data.activity.logs.length).toBeLessThanOrEqual(20)

        // Revenue trend: ensure series exists and includes today's day bucket.
        const points = res.data.charts?.revenue_trend_30d?.points
        expect(Array.isArray(points)).toBe(true)
        const todayKey = isoDay(now)
        const todayPoint = points.find((p: any) => p?.date === todayKey)
        expect(todayPoint).toBeDefined()
        expect(todayPoint.gross_cents).toBeGreaterThanOrEqual(10000)
        expect(todayPoint.platform_commission_cents).toBeGreaterThanOrEqual(1000)

        const segments = res.data.charts?.consultations_by_status?.segments
        expect(Array.isArray(segments)).toBe(true)
        expect(segments.some((s: any) => s.status === "scheduled" && s.count >= 1)).toBe(true)
        expect(segments.some((s: any) => s.status === "completed" && s.count >= 1)).toBe(true)

        const bars = res.data.charts?.orders_by_business_top10?.bars
        expect(Array.isArray(bars)).toBe(true)
        expect(bars.some((b: any) => b.business_id === business.id)).toBe(true)
      })
    })
  },
})

