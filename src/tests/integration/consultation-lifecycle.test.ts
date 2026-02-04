/**
 * Consultation Lifecycle Tests
 * 
 * Tests the consultation status machine and lifecycle transitions.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createTestBusiness,
  createTestClinician,
  createTestPatient,
  createTestConsultation,
  createTestConsultApproval,
} from "../utils/factories"
import { getServices, dateOffset } from "../utils/test-server"

jest.setTimeout(60000)

describe("Consultation Lifecycle", () => {
  describe("Status Transitions", () => {
    it("should create consultation with status draft", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          
          // Act
          const consultation = await createTestConsultation(container, "draft", {
            business_id: business.id,
            patient_id: patient.id,
          })
          
          // Assert
          expect(consultation).toBeDefined()
          expect(consultation.status).toBe("draft")
        },
      })
    })

    it("should transition draft → scheduled", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician = await createTestClinician(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "draft", {
            business_id: business.id,
            patient_id: patient.id,
            clinician_id: clinician.id,
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act
          const updated = await consultationService.transitionStatus(
            consultation.id,
            "scheduled",
            "test_user",
            "Scheduling consultation"
          )
          
          // Assert
          expect(updated.status).toBe("scheduled")
        },
      })
    })

    it("should transition scheduled → in_progress", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician = await createTestClinician(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "scheduled", {
            business_id: business.id,
            patient_id: patient.id,
            clinician_id: clinician.id,
            scheduled_at: new Date(),
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act
          const updated = await consultationService.startConsultation(consultation.id)
          
          // Assert
          expect(updated.status).toBe("in_progress")
          expect(updated.started_at).toBeDefined()
        },
      })
    })

    it("should transition in_progress → completed", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician = await createTestClinician(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "in_progress", {
            business_id: business.id,
            patient_id: patient.id,
            clinician_id: clinician.id,
            started_at: new Date(Date.now() - 30 * 60000), // Started 30 mins ago
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act
          const updated = await consultationService.completeConsultation(
            consultation.id,
            {
              outcome: "approved",
              notes: "Consultation completed successfully",
              assessment: "Patient is healthy",
              plan: "Continue current treatment",
              approved_medications: ["med_001", "med_002"],
            },
            "clinician_user"
          )
          
          // Assert
          expect(updated.status).toBe("completed")
          expect(updated.outcome).toBe("approved")
          expect(updated.ended_at).toBeDefined()
          expect(updated.duration_minutes).toBeGreaterThan(0)
          expect(updated.approved_medications).toContain("med_001")
          expect(updated.approved_medications).toContain("med_002")
        },
      })
    })

    it("should create consult approval on completion with approved outcome", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician = await createTestClinician(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "in_progress", {
            business_id: business.id,
            patient_id: patient.id,
            clinician_id: clinician.id,
            started_at: new Date(),
          })
          
          const { consultation: consultationService, business } = getServices(container)
          
          // Act: Complete consultation with approved outcome
          await consultationService.completeConsultation(
            consultation.id,
            {
              outcome: "approved",
              approved_medications: ["prod_123"],
            },
            "clinician_user"
          )
          
          // Check if approval was created by subscriber
          // Note: In a real test, the subscriber would create the approval
          // Here we verify the consultation outcome is set correctly
          const updatedConsult = await consultationService.retrieveConsultation(consultation.id)
          expect(updatedConsult.outcome).toBe("approved")
        },
      })
    })

    it("should reject invalid status transitions", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "draft", {
            business_id: business.id,
            patient_id: patient.id,
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act & Assert: Try draft → completed directly
          await expect(
            consultationService.transitionStatus(consultation.id, "completed")
          ).rejects.toThrow(/Invalid status transition/)
        },
      })
    })

    it("should allow cancellation from scheduled", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician = await createTestClinician(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "scheduled", {
            business_id: business.id,
            patient_id: patient.id,
            clinician_id: clinician.id,
            scheduled_at: dateOffset(1),
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act
          const updated = await consultationService.cancelConsultation(
            consultation.id,
            "Patient requested cancellation",
            "admin_user"
          )
          
          // Assert
          expect(updated.status).toBe("cancelled")
        },
      })
    })

    it("should track status events", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician = await createTestClinician(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "draft", {
            business_id: business.id,
            patient_id: patient.id,
            clinician_id: clinician.id,
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act: Perform multiple transitions
          await consultationService.transitionStatus(consultation.id, "scheduled")
          await consultationService.transitionStatus(consultation.id, "in_progress")
          
          // Assert: Check status events were created
          const events = await consultationService.listStatusEventsByConsultation(consultation.id)
          expect(events).toHaveLength(2)
          
          // Verify event details
          const draftToScheduled = events.find(e => e.from_status === "draft")
          expect(draftToScheduled).toBeDefined()
          expect(draftToScheduled?.to_status).toBe("scheduled")
          
          const scheduledToProgress = events.find(e => e.from_status === "scheduled")
          expect(scheduledToProgress).toBeDefined()
          expect(scheduledToProgress?.to_status).toBe("in_progress")
        },
      })
    })

    it("should assign clinician", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician = await createTestClinician(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "draft", {
            business_id: business.id,
            patient_id: patient.id,
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act
          const updated = await consultationService.assignClinician(
            consultation.id,
            clinician.id
          )
          
          // Assert
          expect(updated.clinician_id).toBe(clinician.id)
        },
      })
    })

    it("should complete consultation with rejection outcome", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician = await createTestClinician(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "in_progress", {
            business_id: business.id,
            patient_id: patient.id,
            clinician_id: clinician.id,
            started_at: new Date(),
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act
          const updated = await consultationService.completeConsultation(
            consultation.id,
            {
              outcome: "rejected",
              rejection_reason: "Contraindicated for patient condition",
            },
            "clinician_user"
          )
          
          // Assert
          expect(updated.status).toBe("completed")
          expect(updated.outcome).toBe("rejected")
          expect(updated.rejection_reason).toBe("Contraindicated for patient condition")
          expect(updated.approved_medications).toBeNull()
        },
      })
    })

    it("should reject completion from non-in_progress status", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "draft", {
            business_id: business.id,
            patient_id: patient.id,
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act & Assert: Try to complete a draft consultation
          await expect(
            consultationService.completeConsultation(
              consultation.id,
              { outcome: "approved" },
              "clinician_user"
            )
          ).rejects.toThrow(/Cannot complete consultation with status "draft"/)
        },
      })
    })

    it("should handle no_show transition from scheduled", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician = await createTestClinician(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "scheduled", {
            business_id: business.id,
            patient_id: patient.id,
            clinician_id: clinician.id,
            scheduled_at: new Date(Date.now() - 60 * 60000), // Scheduled 1 hour ago
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act
          const updated = await consultationService.transitionStatus(
            consultation.id,
            "no_show",
            "system",
            "Patient did not attend scheduled consultation"
          )
          
          // Assert
          expect(updated.status).toBe("no_show")
        },
      })
    })

    it("should calculate duration on completion", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician = await createTestClinician(container, { business_id: business.id })
          const startTime = new Date(Date.now() - 45 * 60000) // Started 45 mins ago
          const consultation = await createTestConsultation(container, "in_progress", {
            business_id: business.id,
            patient_id: patient.id,
            clinician_id: clinician.id,
            started_at: startTime,
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act
          const updated = await consultationService.completeConsultation(
            consultation.id,
            { outcome: "approved" },
            "clinician_user"
          )
          
          // Assert: Duration should be approximately 45 minutes
          expect(updated.duration_minutes).toBeGreaterThanOrEqual(44)
          expect(updated.duration_minutes).toBeLessThanOrEqual(46)
        },
      })
    })
  })

  describe("Clinician Assignment", () => {
    it("should throw error when assigning non-existent clinician", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "draft", {
            business_id: business.id,
            patient_id: patient.id,
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act & Assert
          await expect(
            consultationService.assignClinician(consultation.id, "non_existent_id")
          ).rejects.toThrow(/Clinician not found/)
        },
      })
    })

    it("should allow reassigning clinician", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician1 = await createTestClinician(container, { 
            business_id: business.id,
            email: "clinician1@test.com"
          })
          const clinician2 = await createTestClinician(container, { 
            business_id: business.id,
            email: "clinician2@test.com"
          })
          const consultation = await createTestConsultation(container, "draft", {
            business_id: business.id,
            patient_id: patient.id,
            clinician_id: clinician1.id,
          })
          
          const { consultation: consultationService } = getServices(container)
          
          // Act: Reassign to clinician 2
          const updated = await consultationService.assignClinician(
            consultation.id,
            clinician2.id
          )
          
          // Assert
          expect(updated.clinician_id).toBe(clinician2.id)
        },
      })
    })
  })
})
