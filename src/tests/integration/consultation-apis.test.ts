/**
 * Consultation API Endpoint Tests
 *
 * Covers:
 * - GET /store/consultations/approvals?product_id={id}
 * - POST /admin/consultations/{id}/assign
 * - POST /admin/consultations/{id}/status
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import jwt from "jsonwebtoken"
import {
  createTestBusiness,
  createTestCustomer,
  createTestPatient,
  createTestProduct,
  createTestClinician,
  createTestConsultation,
  createTestConsultApproval,
} from "../utils/factories"
import { dateOffset } from "../utils/test-server"

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
    describe("Consultation APIs", () => {
      let publishableApiKey: string

      beforeEach(async () => {
        const container = getContainer()
        const apiKeyService = container.resolve("api_key") as any

        const key = await apiKeyService.createApiKeys({
          title: "test publishable key",
          type: "publishable",
          created_by: "integration_test",
        })

        publishableApiKey = key.token
      })

      describe("GET /store/consultations/approvals", () => {
        it("returns has_valid_approval=true for an approved consult within 90 days", async () => {
          const container = getContainer()
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const product = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })

          await createTestConsultApproval(container, "approved", {
            customer_id: customer.id,
            product_id: product.id,
            business_id: business.id,
            consultation_id: "consult_test_001",
            approved_at: dateOffset(-10),
            expires_at: dateOffset(80),
          })

          const customerToken = signCustomerToken(customer.id)

          const res = await api
            .get(`/store/consultations/approvals?product_id=${product.id}`, {
              headers: {
                "x-publishable-api-key": publishableApiKey,
                Authorization: `Bearer ${customerToken}`,
                "x-business-slug": business.slug,
              },
            })
            .catch((e: any) => e.response)

          expect(res.status).toBe(200)
          expect(res.data).toMatchObject({
            has_valid_approval: true,
            consultation_id: "consult_test_001",
          })
          expect(res.data.expires_at).toBeTruthy()
        })

        it("returns has_valid_approval=false when approval is older than 90 days", async () => {
          const container = getContainer()
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const product = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })

          await createTestConsultApproval(container, "approved", {
            customer_id: customer.id,
            product_id: product.id,
            business_id: business.id,
            consultation_id: "consult_test_002",
            approved_at: dateOffset(-91),
            expires_at: dateOffset(10),
          })

          const customerToken = signCustomerToken(customer.id)

          const res = await api
            .get(`/store/consultations/approvals?product_id=${product.id}`, {
              headers: {
                "x-publishable-api-key": publishableApiKey,
                Authorization: `Bearer ${customerToken}`,
                "x-business-slug": business.slug,
              },
            })
            .catch((e: any) => e.response)

          expect(res.status).toBe(200)
          expect(res.data).toMatchObject({
            has_valid_approval: false,
            consultation_id: null,
            expires_at: null,
          })
        })
      })

      describe("POST /admin/consultations/:id/assign", () => {
        it("assigns clinician and writes an audit log", async () => {
          const container = getContainer()
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const patient = await createTestPatient(container, {
            business_id: business.id,
            customer_id: customer.id,
          })
          const clinician = await createTestClinician(container, {
            business_id: business.id,
          })
          const consultation = await createTestConsultation(container, "draft", {
            id: "consult_assign_001",
            business_id: business.id,
            patient_id: patient.id,
            outcome: "pending",
          })
          expect(consultation).toHaveProperty("id")
          const consultationService = container.resolve("consultationModuleService") as any
          const [createdConsults] = await consultationService.listAndCountConsultations(
            { id: consultation.id },
            { take: 1 }
          )
          expect(createdConsults).toHaveLength(1)
          const product = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })

          await createTestConsultApproval(container, "pending", {
            customer_id: customer.id,
            product_id: product.id,
            business_id: business.id,
            consultation_id: consultation.id,
          })

          const adminToken = signAdminToken("user_test_admin", business.id)

          const res = await api
            .post(
              `/admin/consultations/${consultation.id}/assign`,
              { clinician_id: clinician.id },
              { headers: { Authorization: `Bearer ${adminToken}` } }
            )
            .catch((e: any) => e.response)

          expect(res.status).toBe(200)
          expect(res.data.consultation).toMatchObject({
            id: consultation.id,
            business_id: business.id,
            clinician_id: clinician.id,
            status: "scheduled",
          })

          const compliance = container.resolve("complianceModuleService") as any
          const logs = await compliance.listAuditLogs(
            { entity_type: "consultation", entity_id: consultation.id, action: "update" },
            { take: 10, order: { created_at: "DESC" } }
          )

          expect(logs.length).toBeGreaterThan(0)
          expect(logs[0]).toHaveProperty("changes")
        })
      })

      describe("POST /admin/consultations/:id/status", () => {
        it("enforces pending → scheduled → completed → approved and updates consult approval", async () => {
          const container = getContainer()
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const patient = await createTestPatient(container, {
            business_id: business.id,
            customer_id: customer.id,
          })
          const consultation = await createTestConsultation(container, "draft", {
            id: "consult_status_001",
            business_id: business.id,
            patient_id: patient.id,
            outcome: "pending",
          })
          expect(consultation).toHaveProperty("id")
          const consultationService = container.resolve("consultationModuleService") as any
          const [createdConsults] = await consultationService.listAndCountConsultations(
            { id: consultation.id },
            { take: 1 }
          )
          expect(createdConsults).toHaveLength(1)
          const product = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })

          await createTestConsultApproval(container, "pending", {
            customer_id: customer.id,
            product_id: product.id,
            business_id: business.id,
            consultation_id: consultation.id,
          })

          const adminToken = signAdminToken("user_test_admin", business.id)

          const scheduled = await api
            .post(
              `/admin/consultations/${consultation.id}/status`,
              { status: "scheduled" },
              { headers: { Authorization: `Bearer ${adminToken}` } }
            )
            .catch((e: any) => e.response)

          expect(scheduled.status).toBe(200)
          expect(scheduled.data.consultation).toMatchObject({
            id: consultation.id,
            status: "scheduled",
          })

          const completed = await api
            .post(
              `/admin/consultations/${consultation.id}/status`,
              { status: "completed" },
              { headers: { Authorization: `Bearer ${adminToken}` } }
            )
            .catch((e: any) => e.response)

          expect(completed.status).toBe(200)
          expect(completed.data.consultation).toMatchObject({
            id: consultation.id,
            status: "completed",
          })

          const approved = await api
            .post(
              `/admin/consultations/${consultation.id}/status`,
              { status: "approved" },
              { headers: { Authorization: `Bearer ${adminToken}` } }
            )
            .catch((e: any) => e.response)

          expect(approved.status).toBe(200)
          expect(approved.data.consultation).toMatchObject({
            id: consultation.id,
            status: "completed",
            outcome: "approved",
          })

          const businessService = container.resolve("businessModuleService") as any
          const approvals = await businessService.listConsultApprovals(
            { consultation_id: consultation.id },
            { take: 10, order: { approved_at: "DESC" } }
          )

          expect(approvals[0]).toMatchObject({
            consultation_id: consultation.id,
            status: "approved",
            customer_id: customer.id,
            product_id: product.id,
          })

          // Store approval endpoint reflects approval status
          const customerToken = signCustomerToken(customer.id)
          const storeRes = await api
            .get(`/store/consultations/approvals?product_id=${product.id}`, {
              headers: {
                "x-publishable-api-key": publishableApiKey,
                Authorization: `Bearer ${customerToken}`,
                "x-business-slug": business.slug,
              },
            })
            .catch((e: any) => e.response)

          expect(storeRes.status).toBe(200)
          expect(storeRes.data).toMatchObject({
            has_valid_approval: true,
            consultation_id: consultation.id,
          })
        })

        it("reject requires reason and invalid transitions are blocked", async () => {
          const container = getContainer()
          const business = await createTestBusiness(container)
          const customer = await createTestCustomer(container)
          const patient = await createTestPatient(container, {
            business_id: business.id,
            customer_id: customer.id,
          })
          const consultation = await createTestConsultation(container, "draft", {
            id: "consult_status_002",
            business_id: business.id,
            patient_id: patient.id,
            outcome: "pending",
          })
          expect(consultation).toHaveProperty("id")
          const consultationService = container.resolve("consultationModuleService") as any
          const [createdConsults] = await consultationService.listAndCountConsultations(
            { id: consultation.id },
            { take: 1 }
          )
          expect(createdConsults).toHaveLength(1)
          const product = await createTestProduct(container, true, {
            metadata: { requires_consult: true },
          })

          await createTestConsultApproval(container, "pending", {
            customer_id: customer.id,
            product_id: product.id,
            business_id: business.id,
            consultation_id: consultation.id,
          })

          const adminToken = signAdminToken("user_test_admin", business.id)

          const invalid = await api
            .post(
              `/admin/consultations/${consultation.id}/status`,
              { status: "approved" },
              { headers: { Authorization: `Bearer ${adminToken}` } }
            )
            .catch((e: any) => e.response)

          expect(invalid.status).toBe(409)
          expect(invalid.data).toMatchObject({ code: "INVALID_STATE_TRANSITION" })

          await api.post(
            `/admin/consultations/${consultation.id}/status`,
            { status: "scheduled" },
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          await api.post(
            `/admin/consultations/${consultation.id}/status`,
            { status: "completed" },
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )

          const rejectMissingReason = await api
            .post(
              `/admin/consultations/${consultation.id}/status`,
              { status: "rejected" },
              { headers: { Authorization: `Bearer ${adminToken}` } }
            )
            .catch((e: any) => e.response)

          expect(rejectMissingReason.status).toBe(400)
          expect(rejectMissingReason.data).toMatchObject({
            code: "REJECTION_REASON_REQUIRED",
          })
        })
      })
    })
  },
})
