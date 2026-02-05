/**
 * MVP PHI Encryption Smoke Tests
 *
 * Validates that when `PHI_ENCRYPTION_ENABLED=true`, selected PHI fields are
 * encrypted at rest, while service methods return decrypted values.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createTestBusiness } from "../utils/factories"
import { resetEncryptionKeychainCache } from "../../utils/encryption"

jest.setTimeout(60000)

const TEST_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

medusaIntegrationTestRunner({
  env: {
    PHI_ENCRYPTION_ENABLED: "true",
    ENCRYPTION_KEY_CURRENT: TEST_KEY_HEX,
  },
  testSuite: ({ getContainer }) => {
    describe("MVP PHI Encryption", () => {
      beforeEach(() => {
        resetEncryptionKeychainCache()
      })

      it("encrypts patient + consultation + consult submission fields at rest", async () => {
        const container = getContainer()

        const business = await createTestBusiness(container)

        const consultationService = container.resolve("consultationModuleService") as any
        const businessService = container.resolve("businessModuleService") as any

        const patient = await consultationService.createPatient({
          business_id: business.id,
          customer_id: null,
          first_name: "Alice",
          last_name: "Patient",
          email: "alice.patient@test.com",
          phone: "+15551234567",
          date_of_birth: "1990-01-01",
        })

        // Returned value should be decrypted/plain
        expect(patient.email).toBe("alice.patient@test.com")

        const [rawPatients] = await consultationService.listAndCountPatients(
          { id: patient.id },
          { take: 1 }
        )
        expect(rawPatients[0].email).not.toBe("alice.patient@test.com")
        expect(String(rawPatients[0].email)).toMatch(/^v1:/)

        const consultation = await consultationService.createConsultation({
          business_id: business.id,
          patient_id: patient.id,
          clinician_id: null,
          mode: "async_form",
          status: "draft",
          chief_complaint: "Headache",
          medical_history: { allergies: ["penicillin"] },
          notes: "Patient notes",
          admin_notes: "Internal",
          outcome: null,
          approved_medications: [],
          originating_submission_id: null,
          order_id: null,
        })

        expect(consultation.chief_complaint).toBe("Headache")

        const [rawConsultations] = await consultationService.listAndCountConsultations(
          { id: consultation.id },
          { take: 1 }
        )
        expect(String(rawConsultations[0].chief_complaint)).toMatch(/^v1:/)

        const submission = await businessService.createConsultSubmission({
          business_id: business.id,
          location_id: null,
          product_id: "prod_test_001",
          customer_email: "alice.patient@test.com",
          customer_first_name: "Alice",
          customer_last_name: "Patient",
          customer_phone: "+15551234567",
          customer_dob: "1990-01-01",
          eligibility_answers: { state: "FL" },
          status: "pending",
          consult_fee: null,
          notes: "Test notes",
        })

        expect(submission.customer_email).toBe("alice.patient@test.com")

        const rawSubmissions = await businessService.listConsultSubmissions(
          { id: submission.id },
          { take: 1 }
        )
        expect(String(rawSubmissions[0].customer_email)).toMatch(/^v1:/)

        const decryptedAgain = await businessService.retrieveConsultSubmissionDecrypted(submission.id)
        expect(decryptedAgain.customer_email).toBe("alice.patient@test.com")
      })
    })
  },
})

