/**
 * Admin Document API Endpoint Tests (PLAN)
 *
 * Covers:
 * - POST /admin/consultations/{id}/documents
 * - GET /admin/documents?consultation_id={id}
 * - GET /admin/documents/{id}/download
 *
 * These tests use Node's built-in `fetch` + `FormData` for multipart uploads.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import jwt from "jsonwebtoken"
import {
  createTestBusiness,
  createTestPatient,
  createTestClinician,
  createTestConsultation,
} from "../utils/factories"

jest.setTimeout(60000)

function signUserToken(userId: string, businessId?: string): string {
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

function buildPdfBytes(): Uint8Array {
  const contents = [
    "%PDF-1.4\n",
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\n",
    "xref\n0 4\n0000000000 65535 f \n",
    "trailer\n<< /Root 1 0 R /Size 4 >>\nstartxref\n0\n%%EOF\n",
  ].join("")

  return new TextEncoder().encode(contents)
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Admin Document APIs (PLAN)", () => {
      it("uploads, lists, and downloads a PDF for a consultation (admin)", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container)
        const patient = await createTestPatient(container, { business_id: business.id })
        const consultation = await createTestConsultation(container, "draft", {
          business_id: business.id,
          patient_id: patient.id,
        })

        const adminToken = signUserToken("user_admin_01", business.id)
        const baseURL = (api as any).defaults?.baseURL || "http://localhost:9000"

        // Upload (multipart/form-data)
        const pdfBytes = buildPdfBytes()
        const form = new FormData()
        form.append(
          "document",
          new Blob([pdfBytes], { type: "application/pdf" }),
          "test.pdf"
        )
        form.append("type", "medical_record")
        form.append("title", "Test Medical Record")
        form.append("access_level", "clinician")

        const uploadRes = await fetch(`${baseURL}/admin/consultations/${consultation.id}/documents`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          body: form as any,
        })

        const uploadBody = await uploadRes.json().catch(() => ({} as any))

        expect(uploadRes.status).toBe(201)
        expect(uploadBody.document).toBeDefined()
        expect(uploadBody.document.consultation_id).toBe(consultation.id)
        expect(uploadBody.document.mime_type).toBe("application/pdf")

        const documentId = uploadBody.document.id as string
        expect(documentId).toBeTruthy()

        // List
        const listRes = await api
          .get(`/admin/documents?consultation_id=${consultation.id}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(listRes.status).toBe(200)
        expect(listRes.data.documents.find((d: any) => d.id === documentId)).toBeTruthy()

        // Download (stream)
        const downloadRes = await fetch(`${baseURL}/admin/documents/${documentId}/download`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        })

        expect(downloadRes.status).toBe(200)
        expect(downloadRes.headers.get("content-type")).toBe("application/pdf")

        const buf = Buffer.from(await downloadRes.arrayBuffer())
        expect(buf.length).toBeGreaterThan(10)
        expect(buf.slice(0, 4).toString("utf8")).toBe("%PDF")

        // Audit log should contain at least one create + one download entry for this document
        const compliance = container.resolve("complianceModuleService") as any
        const logs = await compliance.listAuditLogs(
          { entity_type: "document", entity_id: documentId },
          { take: 50 }
        )

        const actions = new Set((logs || []).map((l: any) => l.action))
        expect(actions.has("create")).toBe(true)
        expect(actions.has("download")).toBe(true)
      })

      it("enforces file type validation (rejects application/octet-stream)", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container)
        const patient = await createTestPatient(container, { business_id: business.id })
        const consultation = await createTestConsultation(container, "draft", {
          business_id: business.id,
          patient_id: patient.id,
        })

        const adminToken = signUserToken("user_admin_02", business.id)
        const baseURL = (api as any).defaults?.baseURL || "http://localhost:9000"

        const form = new FormData()
        form.append(
          "document",
          new Blob([new Uint8Array([1, 2, 3, 4])], { type: "application/octet-stream" }),
          "bad.bin"
        )
        form.append("type", "other")
        form.append("title", "Bad File")
        form.append("access_level", "clinician")

        const uploadRes = await fetch(`${baseURL}/admin/consultations/${consultation.id}/documents`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
          body: form as any,
        })

        expect(uploadRes.status).toBe(400)
      })

      it("enforces max size validation (rejects >10MB)", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container)
        const patient = await createTestPatient(container, { business_id: business.id })
        const consultation = await createTestConsultation(container, "draft", {
          business_id: business.id,
          patient_id: patient.id,
        })

        const adminToken = signUserToken("user_admin_03", business.id)
        const baseURL = (api as any).defaults?.baseURL || "http://localhost:9000"

        const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 1)

        const form = new FormData()
        form.append(
          "document",
          new Blob([oversized], { type: "application/pdf" }),
          "big.pdf"
        )
        form.append("type", "medical_record")
        form.append("title", "Oversized")
        form.append("access_level", "clinician")

        const uploadRes = await fetch(`${baseURL}/admin/consultations/${consultation.id}/documents`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
          body: form as any,
        })

        expect(uploadRes.status).toBe(413)
      })

      it("restricts clinician access to assigned consultations only", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container)
        const patient = await createTestPatient(container, { business_id: business.id })

        const clinicianUserId = "user_clin_01"
        const clinician = await createTestClinician(container, {
          business_id: business.id,
          user_id: clinicianUserId,
        })

        const otherClinicianUserId = "user_clin_02"
        await createTestClinician(container, {
          business_id: business.id,
          user_id: otherClinicianUserId,
        })

        const consultation = await createTestConsultation(container, "draft", {
          business_id: business.id,
          patient_id: patient.id,
          clinician_id: clinician.id,
        })

        const adminToken = signUserToken("user_admin_04", business.id)
        const baseURL = (api as any).defaults?.baseURL || "http://localhost:9000"

        // Upload as admin to create a document for the consultation
        const form = new FormData()
        form.append(
          "document",
          new Blob([buildPdfBytes()], { type: "application/pdf" }),
          "test.pdf"
        )
        form.append("type", "medical_record")
        form.append("title", "Test")
        form.append("access_level", "clinician")

        const uploadRes = await fetch(`${baseURL}/admin/consultations/${consultation.id}/documents`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
          body: form as any,
        })
        const uploadBody = await uploadRes.json()
        expect(uploadRes.status).toBe(201)
        const documentId = uploadBody.document.id as string

        const clinicianToken = signUserToken(clinicianUserId, business.id)
        const otherClinicianToken = signUserToken(otherClinicianUserId, business.id)

        // Assigned clinician can list
        const listRes = await api
          .get(`/admin/documents?consultation_id=${consultation.id}`, {
            headers: { Authorization: `Bearer ${clinicianToken}` },
          })
          .catch((e: any) => e.response)
        expect(listRes.status).toBe(200)

        // Unassigned clinician should be denied
        const deniedRes = await api
          .get(`/admin/documents?consultation_id=${consultation.id}`, {
            headers: { Authorization: `Bearer ${otherClinicianToken}` },
          })
          .catch((e: any) => e.response)
        expect([403, 404]).toContain(deniedRes.status)

        // Assigned clinician can download
        const downloadRes = await fetch(`${baseURL}/admin/documents/${documentId}/download`, {
          method: "GET",
          headers: { Authorization: `Bearer ${clinicianToken}` },
        })
        expect(downloadRes.status).toBe(200)

        // Unassigned clinician cannot download
        const deniedDownload = await fetch(`${baseURL}/admin/documents/${documentId}/download`, {
          method: "GET",
          headers: { Authorization: `Bearer ${otherClinicianToken}` },
        })
        expect([403, 404]).toContain(deniedDownload.status)
      })
    })
  },
})
