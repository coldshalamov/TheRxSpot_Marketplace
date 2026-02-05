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
 * GET /admin/clinicians/:id
 * Get clinician with tenant isolation
 */
export const GET = [
  authenticate("user", ["session", "bearer"]),
  requireTenantContext(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const tenantContext = (req as any).tenant_context as TenantContext

    try {
      const clinician = await consultationService.getClinicianOrThrow(id)
      
      // ENFORCE tenant isolation
      if (!clinician || clinician.business_id !== tenantContext.business_id) {
        if (clinician) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "clinician",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: clinician.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "clinician",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Clinician")
        return res.status(notFound.status).json(notFound.body)
      }
      
      res.json({ clinician })
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(500).json({
        message: "Failed to retrieve clinician",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

/**
 * PUT /admin/clinicians/:id
 * Update clinician with tenant isolation
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
      const existingClinician = await consultationService.getClinicianOrThrow(id)
      
      // ENFORCE tenant isolation
      if (!existingClinician || existingClinician.business_id !== tenantContext.business_id) {
        if (existingClinician) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "clinician",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: existingClinician.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "clinician",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Clinician")
        return res.status(notFound.status).json(notFound.body)
      }
      
      const update = (req.body ?? {}) as Record<string, any>
      const clinician = await consultationService.updateClinician(id, update)
      res.json({ clinician })
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(400).json({
        message: "Failed to update clinician",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

/**
 * DELETE /admin/clinicians/:id
 * Delete clinician with tenant isolation
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
      const existingClinician = await consultationService.getClinicianOrThrow(id)
      
      // ENFORCE tenant isolation
      if (!existingClinician || existingClinician.business_id !== tenantContext.business_id) {
        if (existingClinician) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "clinician",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: existingClinician.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "clinician",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Clinician")
        return res.status(notFound.status).json(notFound.body)
      }
      
      await consultationService.deleteClinician(id)
      res.status(204).send()
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(500).json({
        message: "Failed to delete clinician",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
