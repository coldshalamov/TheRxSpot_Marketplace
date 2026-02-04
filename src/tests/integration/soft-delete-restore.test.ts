/**
 * Data-level hardening tests (PLAN.txt)
 *
 * Verifies soft delete + restore works end-to-end for at least one entity
 * from each custom module:
 * - businessModuleService: business
 * - consultationModuleService: consultation
 * - complianceModuleService: document
 * - financialsModuleService: earning_entry
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import jwt from "jsonwebtoken"
import {
  createTestBusiness,
  createTestClinician,
  createTestConsultation,
  createTestDocument,
  createTestEarningEntry,
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

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Soft delete + restore (custom modules)", () => {
      it("soft-deletes and restores business, consultation, document, earning_entry", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container)
        const adminToken = signAdminToken("admin_test_user", business.id)

        const patient = await createTestPatient(container, {
          business_id: business.id,
        })

        const clinician = await createTestClinician(container, {
          business_id: business.id,
        })

        const consultation = await createTestConsultation(container, "scheduled" as any, {
          business_id: business.id,
          patient_id: patient.id,
          clinician_id: clinician.id,
        })

        const document = await createTestDocument(container, {
          business_id: business.id,
          patient_id: patient.id,
          consultation_id: consultation.id,
          uploaded_by: "admin_test_user",
        })

        const earning = await createTestEarningEntry(container, "available", {
          business_id: business.id,
          consultation_id: consultation.id,
          order_id: null,
        })

        // -------------------------------------------------------------------
        // Business: DELETE -> hidden from list -> RESTORE -> visible
        // -------------------------------------------------------------------
        const delBusinessRes = await api
          .delete(`/admin/businesses/${business.id}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(delBusinessRes.status).toBe(204)

        const listBusinessesAfterDelete = await api
          .get(`/admin/businesses`, { headers: { Authorization: `Bearer ${adminToken}` } })
          .catch((e: any) => e.response)

        expect(listBusinessesAfterDelete.status).toBe(200)
        expect(listBusinessesAfterDelete.data.businesses?.some((b: any) => b.id === business.id)).toBe(false)

        const restoreBusinessRes = await api
          .post(
            `/admin/businesses/${business.id}/restore`,
            {},
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        if (restoreBusinessRes.status !== 200) {
          throw new Error(
            `restore business failed: ${restoreBusinessRes.status} ${JSON.stringify(restoreBusinessRes.data)}`
          )
        }

        expect(restoreBusinessRes.status).toBe(200)
        expect(restoreBusinessRes.data.business?.id).toBe(business.id)

        const listBusinessesAfterRestore = await api
          .get(`/admin/businesses`, { headers: { Authorization: `Bearer ${adminToken}` } })
          .catch((e: any) => e.response)

        expect(listBusinessesAfterRestore.status).toBe(200)
        expect(listBusinessesAfterRestore.data.businesses?.some((b: any) => b.id === business.id)).toBe(true)

        // -------------------------------------------------------------------
        // Consultation: DELETE -> hidden from list -> RESTORE -> visible
        // -------------------------------------------------------------------
        const delConsultRes = await api
          .delete(`/admin/consultations/${consultation.id}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        if (delConsultRes.status !== 204) {
          throw new Error(
            `delete consultation failed: ${delConsultRes.status} ${JSON.stringify(delConsultRes.data)}`
          )
        }
        expect(delConsultRes.status).toBe(204)

        const listConsultsAfterDelete = await api
          .get(`/admin/consultations?business_id=${business.id}&limit=100&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(listConsultsAfterDelete.status).toBe(200)
        expect(listConsultsAfterDelete.data.consultations?.some((c: any) => c.id === consultation.id)).toBe(false)

        const restoreConsultRes = await api
          .post(
            `/admin/consultations/${consultation.id}/restore`,
            {},
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        expect(restoreConsultRes.status).toBe(200)
        expect(restoreConsultRes.data.consultation?.id).toBe(consultation.id)

        const listConsultsAfterRestore = await api
          .get(`/admin/consultations?business_id=${business.id}&limit=100&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(listConsultsAfterRestore.status).toBe(200)
        expect(listConsultsAfterRestore.data.consultations?.some((c: any) => c.id === consultation.id)).toBe(true)

        // -------------------------------------------------------------------
        // Document: DELETE -> hidden from list -> RESTORE -> visible
        // -------------------------------------------------------------------
        const delDocRes = await api
          .delete(`/admin/documents/${document.id}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(delDocRes.status).toBe(204)

        const listDocsAfterDelete = await api
          .get(`/admin/documents?consultation_id=${consultation.id}&limit=100&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(listDocsAfterDelete.status).toBe(200)
        expect(listDocsAfterDelete.data.documents?.some((d: any) => d.id === document.id)).toBe(false)

        const restoreDocRes = await api
          .post(
            `/admin/documents/${document.id}/restore`,
            {},
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        expect(restoreDocRes.status).toBe(200)

        const listDocsAfterRestore = await api
          .get(`/admin/documents?consultation_id=${consultation.id}&limit=100&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(listDocsAfterRestore.status).toBe(200)
        expect(listDocsAfterRestore.data.documents?.some((d: any) => d.id === document.id)).toBe(true)

        // -------------------------------------------------------------------
        // Earning entry: DELETE -> hidden from list -> RESTORE -> visible
        // -------------------------------------------------------------------
        const delEarnRes = await api
          .delete(`/admin/earnings/${earning.id}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(delEarnRes.status).toBe(204)

        const listEarningsAfterDelete = await api
          .get(`/admin/earnings?business_id=${business.id}&limit=100&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(listEarningsAfterDelete.status).toBe(200)
        expect(listEarningsAfterDelete.data.earnings?.some((en: any) => en.id === earning.id)).toBe(false)

        const restoreEarnRes = await api
          .post(
            `/admin/earnings/${earning.id}/restore`,
            {},
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        expect(restoreEarnRes.status).toBe(200)

        const listEarningsAfterRestore = await api
          .get(`/admin/earnings?business_id=${business.id}&limit=100&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(listEarningsAfterRestore.status).toBe(200)
        expect(listEarningsAfterRestore.data.earnings?.some((en: any) => en.id === earning.id)).toBe(true)
      })
    })
  },
})
