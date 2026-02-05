/**
 * Consultations Management APIs (PLAN)
 *
 * Covers the backend endpoints used by the Admin Consultations list/detail pages:
 * - GET /admin/custom/consultations (paged, filtered, search)
 * - GET /admin/custom/consultations/:id (detail payload)
 * - POST /admin/custom/consultations/:id/notes (notes autosave)
 * - GET /admin/custom/consultations/export (HTML export for "Export PDF" flow)
 * - GET /admin/custom/consultations/:id/export (HTML export for "Export PDF" flow)
 * - POST /admin/consultations/:id/documents (document upload)
 * - GET /admin/documents?consultation_id=... (document list)
 * - GET /admin/documents/:id/download (document download)
 * - GET /admin/audit-logs?consultation_id=... (timeline source)
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import jwt from "jsonwebtoken"
import { Modules } from "@medusajs/framework/utils"
import {
  createTestBusiness,
  createTestClinician,
  createTestPatient,
  createTestConsultation,
  createTestProduct,
} from "../utils/factories"
import { BUSINESS_MODULE } from "../../modules/business"
import { COMPLIANCE_MODULE } from "../../modules/compliance"

jest.setTimeout(60000)

function signAdminToken(userId: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET must be set for integration tests")
  }

  return jwt.sign(
    {
      actor_id: userId,
      actor_type: "user",
      auth_identity_id: "",
      app_metadata: {},
      user_metadata: {},
    },
    secret
  )
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Consultations management (PLAN)", () => {
      it("lists consultations with pagination + filters + search", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container, { name: "Acme Health" })
        const product = await createTestProduct(container, true, { title: "Test Medication" })

        const patient = await createTestPatient(container, {
          business_id: business.id,
          first_name: "Alice",
          last_name: "Patient",
          email: "alice@test.com",
        } as any)

        const clinician = await createTestClinician(container, {
          business_id: business.id,
          first_name: "Bob",
          last_name: "Clinician",
          email: "bob.clinician@test.com",
          status: "active",
        } as any)

        // Create a consult submission so we can derive "type=initial" and "state=FL"
        const businessService = container.resolve(BUSINESS_MODULE) as any
        const submission = await businessService.createConsultSubmission({
          id: `sub_${Date.now()}`,
          business_id: business.id,
          location_id: null,
          product_id: product.id,
          customer_email: patient.email,
          customer_first_name: patient.first_name,
          customer_last_name: patient.last_name,
          customer_phone: patient.phone ?? null,
          customer_dob: patient.date_of_birth ?? null,
          eligibility_answers: { state: "FL", address: "1 Main St", city: "Miami", zip: "33101" },
          status: "pending",
          consult_fee: null,
          notes: null,
          reviewed_by: null,
          reviewed_at: null,
        })

        const consultPending = await createTestConsultation(container, "draft", {
          business_id: business.id,
          patient_id: patient.id,
          clinician_id: null as any,
          mode: "async_form",
          scheduled_at: new Date(),
          originating_submission_id: submission.id,
          order_id: "order_123",
        } as any)

        const consultScheduled = await createTestConsultation(container, "scheduled", {
          business_id: business.id,
          patient_id: patient.id,
          clinician_id: clinician.id,
          mode: "video",
          scheduled_at: new Date(Date.now() + 60 * 60 * 1000),
          originating_submission_id: null as any,
          order_id: "order_456",
        } as any)

        // Seed admin user and token
        const userService = container.resolve(Modules.USER) as any
        const adminUser = await userService.createUsers({
          email: "admin_consults@test.com",
          first_name: "Admin",
          last_name: "Consults",
          metadata: { is_active: true },
        })
        const adminToken = signAdminToken(adminUser.id)

        const listAll = await api
          .get(`/admin/custom/consultations?limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(listAll.status).toBe(200)
        expect(Array.isArray(listAll.data.consultations)).toBe(true)
        expect(listAll.data.consultations.length).toBeGreaterThanOrEqual(2)

        const onlyPending = await api
          .get(`/admin/custom/consultations?status=pending&limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(onlyPending.status).toBe(200)
        expect(onlyPending.data.consultations.every((c: any) => c.plan_status === "pending")).toBe(true)
        expect(onlyPending.data.consultations.some((c: any) => c.id === consultPending.id)).toBe(true)
        expect(onlyPending.data.consultations.some((c: any) => c.id === consultScheduled.id)).toBe(false)

        const searchByClient = await api
          .get(`/admin/custom/consultations?q=${encodeURIComponent("Alice")}&limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(searchByClient.status).toBe(200)
        expect(searchByClient.data.consultations.some((c: any) => c.patient?.first_name === "Alice")).toBe(true)

        const filterState = await api
          .get(`/admin/custom/consultations?state=FL&limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(filterState.status).toBe(200)
        expect(filterState.data.consultations.some((c: any) => c.id === consultPending.id)).toBe(true)
        expect(filterState.data.consultations.some((c: any) => c.id === consultScheduled.id)).toBe(false)

        const filterTypeInitial = await api
          .get(`/admin/custom/consultations?type=initial&limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(filterTypeInitial.status).toBe(200)
        expect(filterTypeInitial.data.consultations.some((c: any) => c.id === consultPending.id)).toBe(true)
        expect(filterTypeInitial.data.consultations.some((c: any) => c.id === consultScheduled.id)).toBe(false)

        const filterClinician = await api
          .get(`/admin/custom/consultations?clinician_id=${encodeURIComponent(clinician.id)}&status=scheduled&limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(filterClinician.status).toBe(200)
        expect(filterClinician.data.consultations.some((c: any) => c.id === consultScheduled.id)).toBe(true)
        expect(filterClinician.data.consultations.some((c: any) => c.id === consultPending.id)).toBe(false)
      })

      it("returns consultation detail payload", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container, { name: "Detail Business" })
        const product = await createTestProduct(container, true, { title: "Detail Medication" })
        const patient = await createTestPatient(container, {
          business_id: business.id,
          first_name: "Detail",
          last_name: "Patient",
          email: "detail.patient@test.com",
          date_of_birth: "1990-01-02",
        } as any)
        const clinician = await createTestClinician(container, {
          business_id: business.id,
          first_name: "Detail",
          last_name: "Clinician",
          email: "detail.clinician@test.com",
          status: "active",
        } as any)

        const businessService = container.resolve(BUSINESS_MODULE) as any
        const submission = await businessService.createConsultSubmission({
          id: `sub_${Date.now()}_detail`,
          business_id: business.id,
          location_id: null,
          product_id: product.id,
          customer_email: patient.email,
          customer_first_name: patient.first_name,
          customer_last_name: patient.last_name,
          customer_phone: patient.phone ?? null,
          customer_dob: patient.date_of_birth ?? null,
          eligibility_answers: { state: "CA" },
          status: "pending",
          consult_fee: null,
          notes: null,
          reviewed_by: null,
          reviewed_at: null,
        })

        const consultation = await createTestConsultation(container, "scheduled", {
          business_id: business.id,
          patient_id: patient.id,
          clinician_id: clinician.id,
          mode: "video",
          scheduled_at: new Date(),
          originating_submission_id: submission.id,
          order_id: "order_detail_1",
          notes: "Clinician notes",
        } as any)

        const userService = container.resolve(Modules.USER) as any
        const adminUser = await userService.createUsers({
          email: "admin_consults_detail@test.com",
          first_name: "Admin",
          last_name: "Detail",
          metadata: { is_active: true },
        })
        const adminToken = signAdminToken(adminUser.id)

        const res = await api
          .get(`/admin/custom/consultations/${encodeURIComponent(consultation.id)}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(res.status).toBe(200)
        expect(res.data.consultation?.id).toBe(consultation.id)
        expect(res.data.consultation?.business?.id).toBe(business.id)
        expect(res.data.consultation?.patient?.email).toBe(patient.email)
        expect(res.data.consultation?.clinician?.id).toBe(clinician.id)
        expect(res.data.consultation?.product?.id).toBe(product.id)
        expect(res.data.consultation?.state).toBe("CA")
        expect(res.data.consultation?.plan_status).toBe("scheduled")
      })

      it("updates notes (autosave) and writes an audit log", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container)
        const patient = await createTestPatient(container, { business_id: business.id } as any)
        const consultation = await createTestConsultation(container, "draft", {
          business_id: business.id,
          patient_id: patient.id,
          notes: null as any,
        } as any)

        const userService = container.resolve(Modules.USER) as any
        const adminUser = await userService.createUsers({
          email: "admin_notes@test.com",
          first_name: "Admin",
          last_name: "Notes",
          metadata: { is_active: true },
        })
        const adminToken = signAdminToken(adminUser.id)

        const update = await api
          .post(
            `/admin/custom/consultations/${encodeURIComponent(consultation.id)}/notes`,
            { notes: "New clinician notes", admin_notes: "Internal admin note" },
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        expect(update.status).toBe(200)
        expect(update.data.consultation?.id).toBe(consultation.id)
        expect(update.data.consultation?.notes).toBe("New clinician notes")
        expect(update.data.consultation?.admin_notes).toBe("Internal admin note")

        const compliance = container.resolve(COMPLIANCE_MODULE) as any
        const listed = await compliance.listAuditLogs(
          { entity_type: "consultation", entity_id: consultation.id },
          { take: 50, order: { created_at: "DESC" } }
        )
        const logs = Array.isArray(listed?.[0]) ? listed[0] : listed

        expect(Array.isArray(logs)).toBe(true)
        expect(logs.length).toBeGreaterThan(0)
      })

      it("exports HTML for list + detail (PDF flow)", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container)
        const patient = await createTestPatient(container, { business_id: business.id } as any)
        const consultation = await createTestConsultation(container, "draft", {
          business_id: business.id,
          patient_id: patient.id,
          scheduled_at: new Date(),
        } as any)

        const userService = container.resolve(Modules.USER) as any
        const adminUser = await userService.createUsers({
          email: "admin_export@test.com",
          first_name: "Admin",
          last_name: "Export",
          metadata: { is_active: true },
        })
        const adminToken = signAdminToken(adminUser.id)

        const listRes = await fetch(
          `${api.defaults.baseURL}/admin/custom/consultations/export?ids=${encodeURIComponent(
            consultation.id
          )}`,
          { headers: { Authorization: `Bearer ${adminToken}` } }
        )

        expect(listRes.status).toBe(200)
        expect(listRes.headers.get("content-type") || "").toContain("text/html")
        const listHtml = await listRes.text()
        expect(listHtml).toContain(consultation.id)

        const detailRes = await fetch(
          `${api.defaults.baseURL}/admin/custom/consultations/${encodeURIComponent(
            consultation.id
          )}/export`,
          { headers: { Authorization: `Bearer ${adminToken}` } }
        )

        expect(detailRes.status).toBe(200)
        expect(detailRes.headers.get("content-type") || "").toContain("text/html")
        const detailHtml = await detailRes.text()
        expect(detailHtml).toContain(consultation.id)
      })

      it("uploads + lists + downloads a document and surfaces events in audit logs", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container, { name: "Docs Business" })
        const product = await createTestProduct(container, true, { title: "Docs Medication" })
        const patient = await createTestPatient(container, {
          business_id: business.id,
          first_name: "Doc",
          last_name: "Patient",
          email: "doc.patient@test.com",
        } as any)

        const businessService = container.resolve(BUSINESS_MODULE) as any
        const submission = await businessService.createConsultSubmission({
          id: `sub_${Date.now()}_docs`,
          business_id: business.id,
          location_id: null,
          product_id: product.id,
          customer_email: patient.email,
          customer_first_name: patient.first_name,
          customer_last_name: patient.last_name,
          customer_phone: patient.phone ?? null,
          customer_dob: patient.date_of_birth ?? null,
          eligibility_answers: { state: "TX" },
          status: "pending",
          consult_fee: null,
          notes: null,
          reviewed_by: null,
          reviewed_at: null,
        })

        const consultation = await createTestConsultation(container, "scheduled", {
          business_id: business.id,
          patient_id: patient.id,
          clinician_id: null as any,
          mode: "video",
          scheduled_at: new Date(),
          originating_submission_id: submission.id,
          order_id: "order_docs_1",
        } as any)

        const userService = container.resolve(Modules.USER) as any
        const adminUser = await userService.createUsers({
          email: "admin_docs@test.com",
          first_name: "Admin",
          last_name: "Docs",
          metadata: { is_active: true, business_id: business.id },
        })
        const adminToken = signAdminToken(adminUser.id)

        const pdfHeader = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n", "utf8")
        const form = new FormData()
        form.append(
          "document",
          new Blob([pdfHeader], { type: "application/pdf" }),
          "test.pdf"
        )
        form.append("type", "medical_record")
        form.append("title", "Test Medical Record")
        form.append("access_level", "clinician")

        const uploadRes = await fetch(
          `${api.defaults.baseURL}/admin/consultations/${encodeURIComponent(consultation.id)}/documents`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: form,
          }
        )

        expect(uploadRes.status).toBe(201)
        const uploaded = await uploadRes.json()
        expect(uploaded.document?.id).toBeTruthy()
        expect(uploaded.document?.consultation_id).toBe(consultation.id)
        expect(uploaded.document?.mime_type).toBe("application/pdf")

        const documentId = uploaded.document.id as string

        const listRes = await api
          .get(
            `/admin/documents?consultation_id=${encodeURIComponent(consultation.id)}&limit=20&offset=0`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        expect(listRes.status).toBe(200)
        expect(Array.isArray(listRes.data.documents)).toBe(true)
        expect(listRes.data.documents.some((d: any) => d.id === documentId)).toBe(true)

        const downloadRes = await fetch(
          `${api.defaults.baseURL}/admin/documents/${encodeURIComponent(documentId)}/download`,
          { headers: { Authorization: `Bearer ${adminToken}` } }
        )

        expect(downloadRes.status).toBe(200)
        expect(downloadRes.headers.get("content-type") || "").toContain("application/pdf")
        const downloadBuf = Buffer.from(await downloadRes.arrayBuffer())
        expect(downloadBuf.slice(0, 4).toString("utf8")).toBe("%PDF")

        const auditRes = await api
          .get(`/admin/audit-logs?consultation_id=${encodeURIComponent(consultation.id)}&limit=50&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(auditRes.status).toBe(200)
        expect(Array.isArray(auditRes.data.logs)).toBe(true)
        expect(auditRes.data.logs.some((l: any) => l.entity_type === "document" && l.action === "create")).toBe(true)
        expect(auditRes.data.logs.some((l: any) => l.entity_type === "document" && l.action === "download")).toBe(true)
      })
    })
  },
})
