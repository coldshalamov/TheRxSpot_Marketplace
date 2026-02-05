import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../modules/consultation"
import { 
  requireTenantContext, 
  verifyTenantAccess, 
  createNotFoundResponse,
  logSecurityEvent,
  TenantContext 
} from "../../../middlewares/tenant-isolation"

/**
 * GET /admin/patients/:id
 * Get patient with tenant isolation
 */
export const GET = [
  authenticate("user", ["session", "bearer"]),
  requireTenantContext(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const tenantContext = (req as any).tenant_context as TenantContext

    try {
      const patient = await consultationService.getPatientOrThrow(id)
      
      // ENFORCE tenant isolation
      if (!patient || patient.business_id !== tenantContext.business_id) {
        // Log security event for cross-tenant access attempt
        if (patient) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "patient",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: patient.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "patient",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Patient")
        return res.status(notFound.status).json(notFound.body)
      }
      
      // Get consultation history
      const consultations = await consultationService.getPatientConsultationHistory(id)

      res.json({
        patient: {
          ...patient,
          consultation_history: consultations,
        },
        consultation_count: consultations.length,
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(500).json({
        message: "Failed to retrieve patient",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

/**
 * PUT /admin/patients/:id
 * Update patient with tenant isolation
 */
export const PUT = [
  authenticate("user", ["session", "bearer"]),
  requireTenantContext(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const tenantContext = (req as any).tenant_context as TenantContext

    try {
      // First retrieve to check tenant isolation
      const existingPatient = await consultationService.getPatientOrThrow(id)
      
      // ENFORCE tenant isolation
      if (!existingPatient || existingPatient.business_id !== tenantContext.business_id) {
        if (existingPatient) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "patient",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: existingPatient.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "patient",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Patient")
        return res.status(notFound.status).json(notFound.body)
      }
      
      const update = (req.body ?? {}) as Record<string, any>
      const patient = await consultationService.updatePatient(id, update)
      res.json({ patient })
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(400).json({
        message: "Failed to update patient",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

/**
 * DELETE /admin/patients/:id
 * Delete patient with tenant isolation
 */
export const DELETE = [
  authenticate("user", ["session", "bearer"]),
  requireTenantContext(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const tenantContext = (req as any).tenant_context as TenantContext

    try {
      // First retrieve to check tenant isolation
      const existingPatient = await consultationService.getPatientOrThrow(id)
      
      // ENFORCE tenant isolation
      if (!existingPatient || existingPatient.business_id !== tenantContext.business_id) {
        if (existingPatient) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "patient",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: existingPatient.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "patient",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Patient")
        return res.status(notFound.status).json(notFound.body)
      }
      
      // Check if patient has consultations
      const consultations = await consultationService.getPatientConsultationHistory(id)
      if (consultations.length > 0) {
        return res.status(400).json({
          message: "Cannot delete patient with existing consultations. Consider archiving instead.",
          consultation_count: consultations.length,
        })
      }

      await consultationService.deletePatient(id)
      res.status(204).send()
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(500).json({
        message: "Failed to delete patient",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
