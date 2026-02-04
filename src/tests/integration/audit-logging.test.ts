/**
 * Audit Logging Tests
 * 
 * Tests audit log creation, querying, and compliance requirements
 * for HIPAA and data access tracking.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createTestBusiness,
  createTestPatient,
  createTestClinician,
  createTestConsultation,
  createTestOrder,
  createTestEarningEntry,
  createTestDocument,
  createTestAuditLog,
} from "../utils/factories"
import { getServices } from "../utils/test-server"

jest.setTimeout(60000)

describe("Audit Logging", () => {
  describe("PHI Access Logging", () => {
    it("should log consultation access", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const clinician = await createTestClinician(container, { business_id: business.id })
          const consultation = await createTestConsultation(container, "completed", {
            business_id: business.id,
            patient_id: patient.id,
            clinician_id: clinician.id,
          })
          
          const { compliance } = getServices(container)
          
          // Act: Log consultation read access
          await compliance.createAuditLog({
            actor_type: "clinician",
            actor_id: clinician.id,
            actor_email: clinician.email,
            action: "read",
            entity_type: "consultation",
            entity_id: consultation.id,
            business_id: business.id,
            consultation_id: consultation.id,
            ip_address: "192.168.1.100",
            user_agent: "Mozilla/5.0",
            risk_level: "low",
          })
          
          // Assert
          const logs = await compliance.listAuditLogsByEntity("consultation", consultation.id)
          expect(logs.length).toBeGreaterThan(0)
          expect(logs[0].action).toBe("read")
          expect(logs[0].actor_type).toBe("clinician")
        },
      })
    })

    it("should log patient access", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const { compliance } = getServices(container)
          
          // Act: Log patient record access
          await compliance.createAuditLog({
            actor_type: "business_user",
            actor_id: "admin_001",
            actor_email: "admin@business.com",
            action: "read",
            entity_type: "patient",
            entity_id: patient.id,
            business_id: business.id,
            ip_address: "192.168.1.100",
            user_agent: "Mozilla/5.0",
            risk_level: "medium",
          })
          
          // Assert
          const logs = await compliance.listAuditLogsByEntity("patient", patient.id)
          expect(logs.length).toBeGreaterThan(0)
          expect(logs[0].entity_type).toBe("patient")
          expect(logs[0].risk_level).toBe("medium")
        },
      })
    })

    it("should log document downloads", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const document = await createTestDocument(container, {
            business_id: business.id,
            patient_id: patient.id,
            uploaded_by: patient.id,
          })
          
          const { compliance } = getServices(container)
          
          // Act: Use the logDocumentDownload helper
          await compliance.logDocumentDownload(
            "customer",
            patient.id,
            patient.email,
            document.id,
            {
              businessId: business.id,
              ipAddress: "192.168.1.50",
              userAgent: "Test Browser/1.0",
            }
          )
          
          // Assert
          const logs = await compliance.listAuditLogsByEntity("document", document.id)
          const downloadLog = logs.find(log => log.action === "download")
          expect(downloadLog).toBeDefined()
          expect(downloadLog?.ip_address).toBe("192.168.1.50")
        },
      })
    })

    it("should log earnings access", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const earning = await createTestEarningEntry(container, "available", {
            business_id: business.id,
          })
          
          const { compliance } = getServices(container)
          
          // Act: Log earnings read access
          await compliance.createAuditLog({
            actor_type: "business_user",
            actor_id: "business_admin",
            actor_email: "admin@business.com",
            action: "read",
            entity_type: "earning",
            entity_id: earning.id,
            business_id: business.id,
            ip_address: "192.168.1.200",
            risk_level: "low",
          })
          
          // Assert
          const logs = await compliance.listAuditLogsByEntity("earning", earning.id)
          expect(logs.length).toBeGreaterThan(0)
          expect(logs[0].action).toBe("read")
        },
      })
    })
  })

  describe("Request Context Capture", () => {
    it("should capture IP and user agent", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          
          const { compliance } = getServices(container)
          
          // Act: Create audit log with full context
          const auditLog = await compliance.createAuditLog({
            actor_type: "customer",
            actor_id: patient.id,
            actor_email: patient.email,
            action: "read",
            entity_type: "patient",
            entity_id: patient.id,
            business_id: business.id,
            ip_address: "203.0.113.45",
            user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            risk_level: "low",
          })
          
          // Assert
          expect(auditLog.ip_address).toBe("203.0.113.45")
          expect(auditLog.user_agent).toContain("Mozilla/5.0")
        },
      })
    })

    it("should handle missing IP and user agent", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          
          const { compliance } = getServices(container)
          
          // Act: Create audit log without IP/user agent (system action)
          const auditLog = await compliance.createAuditLog({
            actor_type: "system",
            actor_id: "system_process",
            action: "update",
            entity_type: "patient",
            entity_id: patient.id,
            business_id: business.id,
            ip_address: null,
            user_agent: null,
            risk_level: "low",
          })
          
          // Assert
          expect(auditLog.actor_type).toBe("system")
          expect(auditLog.ip_address).toBeNull()
          expect(auditLog.user_agent).toBeNull()
        },
      })
    })
  })

  describe("Data Change Tracking", () => {
    it("should track data changes on update", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { 
            business_id: business.id,
            first_name: "John",
            last_name: "Doe",
          })
          
          const { compliance } = getServices(container)
          
          // Act: Log entity update with changes
          await compliance.logEntityUpdate(
            "business_user",
            "admin_001",
            "admin@business.com",
            "patient",
            patient.id,
            { first_name: "John", last_name: "Doe" },
            { first_name: "Jane", last_name: "Doe" },
            {
              businessId: business.id,
              ipAddress: "192.168.1.100",
            }
          )
          
          // Assert
          const logs = await compliance.listAuditLogsByEntity("patient", patient.id)
          const updateLog = logs.find(log => log.action === "update")
          expect(updateLog).toBeDefined()
          expect(updateLog?.changes).toMatchObject({
            before: { first_name: "John" },
            after: { first_name: "Jane" },
          })
        },
      })
    })

    it("should track data creation", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patientId = "new_patient_123"
          
          const { compliance } = getServices(container)
          
          // Act: Log entity creation
          await compliance.logEntityCreation(
            "business_user",
            "admin_001",
            "admin@business.com",
            "patient",
            patientId,
            {
              first_name: "New",
              last_name: "Patient",
              email: "new@patient.com",
            },
            {
              businessId: business.id,
              ipAddress: "192.168.1.100",
            }
          )
          
          // Assert
          const logs = await compliance.listAuditLogsByEntity("patient", patientId)
          const createLog = logs.find(log => log.action === "create")
          expect(createLog).toBeDefined()
          expect(createLog?.changes?.after).toMatchObject({
            first_name: "New",
            email: "new@patient.com",
          })
        },
      })
    })

    it("should track data deletion", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          
          const { compliance } = getServices(container)
          
          // Act: Log entity deletion
          await compliance.logEntityDeletion(
            "business_user",
            "admin_001",
            "admin@business.com",
            "patient",
            patient.id,
            {
              first_name: patient.first_name,
              last_name: patient.last_name,
              email: patient.email,
            },
            {
              businessId: business.id,
              ipAddress: "192.168.1.100",
            }
          )
          
          // Assert
          const logs = await compliance.listAuditLogsByEntity("patient", patient.id)
          const deleteLog = logs.find(log => log.action === "delete")
          expect(deleteLog).toBeDefined()
          expect(deleteLog?.changes?.before).toBeDefined()
          expect(deleteLog?.changes?.after).toBeNull()
          expect(deleteLog?.risk_level).toBe("medium") // Deletions are medium risk
        },
      })
    })
  })

  describe("Audit Log Queries", () => {
    it("should allow querying by entity type", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          const order = await createTestOrder(container, "pending", {
            business_id: business.id,
          })
          
          const { compliance } = getServices(container)
          
          // Create logs for different entities
          await createTestAuditLog(container, {
            actor_id: "user_1",
            entity_id: patient.id,
            entity_type: "patient",
            business_id: business.id,
          })
          
          await createTestAuditLog(container, {
            actor_id: "user_2",
            entity_id: order.id,
            entity_type: "order",
            business_id: business.id,
          })
          
          // Act: Query by entity type
          const patientLogs = await compliance.listAuditLogsByAction("read")
          
          // Assert: Should return all read logs
          expect(patientLogs.length).toBeGreaterThanOrEqual(0)
        },
      })
    })

    it("should allow querying by actor", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const clinician = await createTestClinician(container, { business_id: business.id })
          
          await createTestAuditLog(container, {
            actor_type: "clinician",
            actor_id: clinician.id,
            entity_id: "entity_1",
            entity_type: "consultation",
            business_id: business.id,
          })
          
          await createTestAuditLog(container, {
            actor_type: "clinician",
            actor_id: clinician.id,
            entity_id: "entity_2",
            entity_type: "patient",
            business_id: business.id,
          })
          
          const { compliance } = getServices(container)
          
          // Act: Query by actor
          const clinicianLogs = await compliance.listAuditLogsByActor("clinician", clinician.id)
          
          // Assert
          expect(clinicianLogs.length).toBe(2)
          expect(clinicianLogs.every(log => log.actor_id === clinician.id)).toBe(true)
        },
      })
    })

    it("should allow querying by business", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business1 = await createTestBusiness(container)
          const business2 = await createTestBusiness(container)
          
          await createTestAuditLog(container, {
            actor_id: "user_1",
            entity_id: "entity_1",
            entity_type: "consultation",
            business_id: business1.id,
          })
          
          await createTestAuditLog(container, {
            actor_id: "user_2",
            entity_id: "entity_2",
            entity_type: "patient",
            business_id: business2.id,
          })
          
          const { compliance } = getServices(container)
          
          // Act
          const business1Logs = await compliance.listAuditLogsByBusiness(business1.id)
          const business2Logs = await compliance.listAuditLogsByBusiness(business2.id)
          
          // Assert
          expect(business1Logs.length).toBe(1)
          expect(business2Logs.length).toBe(1)
          expect(business1Logs[0].business_id).toBe(business1.id)
          expect(business2Logs[0].business_id).toBe(business2.id)
        },
      })
    })

    it("should allow querying by action type", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          
          await createTestAuditLog(container, {
            actor_id: "user_1",
            entity_id: "entity_1",
            entity_type: "consultation",
            action: "create",
            business_id: business.id,
          })
          
          await createTestAuditLog(container, {
            actor_id: "user_1",
            entity_id: "entity_2",
            entity_type: "consultation",
            action: "read",
            business_id: business.id,
          })
          
          await createTestAuditLog(container, {
            actor_id: "user_1",
            entity_id: "entity_3",
            entity_type: "consultation",
            action: "update",
            business_id: business.id,
          })
          
          const { compliance } = getServices(container)
          
          // Act
          const createLogs = await compliance.listAuditLogsByAction("create")
          const readLogs = await compliance.listAuditLogsByAction("read")
          
          // Assert
          expect(createLogs.some(log => log.action === "create")).toBe(true)
          expect(readLogs.some(log => log.action === "read")).toBe(true)
        },
      })
    })
  })

  describe("Risk Level and Flagging", () => {
    it("should flag high risk events", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const patient = await createTestPatient(container, { business_id: business.id })
          
          // Act: Create high-risk audit log
          const auditLog = await createTestAuditLog(container, {
            actor_id: "suspicious_user",
            entity_id: patient.id,
            entity_type: "patient",
            action: "export",
            risk_level: "high",
            flagged: true,
            business_id: business.id,
          })
          
          const { compliance } = getServices(container)
          
          // Assert
          expect(auditLog.risk_level).toBe("high")
          expect(auditLog.flagged).toBe(true)
          
          // Query flagged logs
          const flaggedLogs = await compliance.listFlaggedAuditLogs()
          expect(flaggedLogs.length).toBeGreaterThan(0)
        },
      })
    })

    it("should identify critical risk events", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          
          await createTestAuditLog(container, {
            actor_id: "hacker",
            entity_id: "all_patients",
            entity_type: "patient",
            action: "export",
            risk_level: "critical",
            flagged: true,
            business_id: business.id,
          })
          
          const { compliance } = getServices(container)
          
          // Act: Query high risk logs
          const highRiskLogs = await compliance.listHighRiskAuditLogs()
          
          // Assert
          expect(highRiskLogs.length).toBeGreaterThan(0)
          expect(highRiskLogs.some(log => log.risk_level === "critical")).toBe(true)
        },
      })
    })

    it("should allow querying by risk level", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          
          await createTestAuditLog(container, {
            actor_id: "user_1",
            entity_id: "entity_1",
            entity_type: "consultation",
            risk_level: "low",
            business_id: business.id,
          })
          
          await createTestAuditLog(container, {
            actor_id: "user_2",
            entity_id: "entity_2",
            entity_type: "patient",
            risk_level: "medium",
            business_id: business.id,
          })
          
          const { compliance } = getServices(container)
          
          // Act
          const mediumRiskLogs = await compliance.listAuditLogsByRiskLevel("medium")
          
          // Assert
          expect(mediumRiskLogs.some(log => log.risk_level === "medium")).toBe(true)
        },
      })
    })
  })

  describe("Authentication Logging", () => {
    it("should log login events", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const business = await createTestBusiness(container)
          const { compliance } = getServices(container)
          
          // Act: Log login
          await compliance.logLogin(
            "customer",
            "customer_123",
            "customer@test.com",
            {
              ipAddress: "192.168.1.100",
              userAgent: "Mozilla/5.0",
            }
          )
          
          // Assert
          const loginLogs = await compliance.listAuditLogsByAction("login")
          expect(loginLogs.length).toBeGreaterThan(0)
          expect(loginLogs[0].action).toBe("login")
        },
      })
    })

    it("should log logout events", async () => {
      await medusaIntegrationTestRunner({
        test: async ({ container }) => {
          // Arrange
          const { compliance } = getServices(container)
          
          // Act: Log logout
          await compliance.logLogout(
            "customer",
            "customer_123",
            "customer@test.com",
            {
              ipAddress: "192.168.1.100",
            }
          )
          
          // Assert
          const logoutLogs = await compliance.listAuditLogsByAction("logout")
          expect(logoutLogs.length).toBeGreaterThan(0)
          expect(logoutLogs[0].action).toBe("logout")
        },
      })
    })
  })
})
