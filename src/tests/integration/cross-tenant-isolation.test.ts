/**
 * Cross-Tenant Isolation Tests
 *
 * Phase 1 - Workstream A: Verifies that tenant-scoped data cannot be accessed
 * across business boundaries. Tests all critical entity types.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createTestBusiness,
  createTestPatient,
  createTestConsultation,
  createTestDocument,
  createTestEarningEntry,
  createTestConsultSubmission,
} from "../utils/factories"

jest.setTimeout(60000)

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("Cross-Tenant Isolation", () => {
      let businessA: any
      let businessB: any

      beforeEach(async () => {
        const container = getContainer()
        businessA = await createTestBusiness(container, { slug: "tenant-a" })
        businessB = await createTestBusiness(container, { slug: "tenant-b" })
      })

      describe("Consultations", () => {
        it("lists only consultations belonging to the queried business", async () => {
          const container = getContainer()
          const consultService = container.resolve("consultationModuleService") as any

          const patientA = await createTestPatient(container, { business_id: businessA.id })
          const patientB = await createTestPatient(container, { business_id: businessB.id })

          await createTestConsultation(container, "draft", {
            business_id: businessA.id,
            patient_id: patientA.id,
          })
          await createTestConsultation(container, "draft", {
            business_id: businessB.id,
            patient_id: patientB.id,
          })

          const [consultationsA] = await consultService.listConsultations({ business_id: businessA.id })
          const [consultationsB] = await consultService.listConsultations({ business_id: businessB.id })

          expect(consultationsA.length).toBe(1)
          expect(consultationsB.length).toBe(1)
          expect(consultationsA[0].business_id).toBe(businessA.id)
          expect(consultationsB[0].business_id).toBe(businessB.id)
        })
      })

      describe("Patients", () => {
        it("lists only patients belonging to the queried business", async () => {
          const container = getContainer()
          const consultService = container.resolve("consultationModuleService") as any

          await createTestPatient(container, { business_id: businessA.id })
          await createTestPatient(container, { business_id: businessB.id })

          const [patientsA] = await consultService.listAndCountPatients({ business_id: businessA.id })
          const [patientsB] = await consultService.listAndCountPatients({ business_id: businessB.id })

          expect(patientsA.length).toBe(1)
          expect(patientsB.length).toBe(1)
          expect(patientsA[0].business_id).toBe(businessA.id)
          expect(patientsB[0].business_id).toBe(businessB.id)
        })
      })

      describe("Documents", () => {
        it("lists only documents belonging to the queried business", async () => {
          const container = getContainer()
          const complianceService = container.resolve("complianceModuleService") as any

          const patientA = await createTestPatient(container, { business_id: businessA.id })
          const patientB = await createTestPatient(container, { business_id: businessB.id })

          await createTestDocument(container, {
            business_id: businessA.id,
            patient_id: patientA.id,
            uploaded_by: patientA.id,
          })
          await createTestDocument(container, {
            business_id: businessB.id,
            patient_id: patientB.id,
            uploaded_by: patientB.id,
          })

          const docsA = await complianceService.listDocuments({ business_id: businessA.id })
          const docsB = await complianceService.listDocuments({ business_id: businessB.id })

          expect(docsA.documents.length).toBe(1)
          expect(docsB.documents.length).toBe(1)
          expect(docsA.documents[0].business_id).toBe(businessA.id)
          expect(docsB.documents[0].business_id).toBe(businessB.id)
        })
      })

      describe("Earnings", () => {
        it("lists only earnings belonging to the queried business", async () => {
          const container = getContainer()
          const financialsService = container.resolve("financialsModuleService") as any

          await createTestEarningEntry(container, "pending", { business_id: businessA.id })
          await createTestEarningEntry(container, "pending", { business_id: businessB.id })

          const earningsA = await financialsService.listEarningEntries({ business_id: businessA.id })
          const earningsB = await financialsService.listEarningEntries({ business_id: businessB.id })

          expect(earningsA.length).toBe(1)
          expect(earningsB.length).toBe(1)
          expect(earningsA[0].business_id).toBe(businessA.id)
          expect(earningsB[0].business_id).toBe(businessB.id)
        })
      })

      describe("Consult Submissions", () => {
        it("lists only submissions belonging to the queried business", async () => {
          const container = getContainer()
          const businessService = container.resolve("businessModuleService") as any

          await createTestConsultSubmission(container, {
            business_id: businessA.id,
            product_id: "prod_1",
            customer_email: "alice@a.com",
            customer_first_name: "Alice",
            customer_last_name: "A",
          })
          await createTestConsultSubmission(container, {
            business_id: businessB.id,
            product_id: "prod_2",
            customer_email: "bob@b.com",
            customer_first_name: "Bob",
            customer_last_name: "B",
          })

          const subsA = await businessService.listConsultSubmissionsByBusiness(businessA.id)
          const subsB = await businessService.listConsultSubmissionsByBusiness(businessB.id)

          expect(subsA.length).toBe(1)
          expect(subsB.length).toBe(1)
          expect(subsA[0].business_id).toBe(businessA.id)
          expect(subsB[0].business_id).toBe(businessB.id)
        })
      })

      describe("Locations", () => {
        it("lists only locations belonging to the queried business", async () => {
          const container = getContainer()
          const businessService = container.resolve("businessModuleService") as any

          await businessService.createLocations({
            business_id: businessA.id,
            name: "Location A",
            phone: "555-0001",
          })
          await businessService.createLocations({
            business_id: businessB.id,
            name: "Location B",
            phone: "555-0002",
          })

          const locsA = await businessService.listLocations({ business_id: businessA.id })
          const locsB = await businessService.listLocations({ business_id: businessB.id })

          expect(locsA.length).toBe(1)
          expect(locsB.length).toBe(1)
          expect(locsA[0].business_id).toBe(businessA.id)
          expect(locsB[0].business_id).toBe(businessB.id)
        })
      })

      describe("Coupons", () => {
        it("lists only coupons belonging to the queried business", async () => {
          const container = getContainer()
          const businessService = container.resolve("businessModuleService") as any

          await businessService.createCoupons({
            business_id: businessA.id,
            code: "TENA10",
            type: "percentage",
            value: 10,
          })
          await businessService.createCoupons({
            business_id: businessB.id,
            code: "TENB20",
            type: "percentage",
            value: 20,
          })

          const couponsA = await businessService.listCouponsByBusiness(businessA.id)
          const couponsB = await businessService.listCouponsByBusiness(businessB.id)

          expect(couponsA.length).toBe(1)
          expect(couponsB.length).toBe(1)
          expect(couponsA[0].business_id).toBe(businessA.id)
          expect(couponsB[0].business_id).toBe(businessB.id)
        })
      })

      describe("Template Configs", () => {
        it("returns only the template for the queried business", async () => {
          const container = getContainer()
          const businessService = container.resolve("businessModuleService") as any

          await businessService.createDefaultTemplate(businessA.id)
          await businessService.createDefaultTemplate(businessB.id)

          const templateA = await businessService.getPublishedTemplate(businessA.id)
          const templateB = await businessService.getPublishedTemplate(businessB.id)

          expect(templateA).not.toBeNull()
          expect(templateB).not.toBeNull()
          expect(templateA.business_id).toBe(businessA.id)
          expect(templateB.business_id).toBe(businessB.id)
        })
      })
    })
  },
})
