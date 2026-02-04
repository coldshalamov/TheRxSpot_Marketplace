import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"
import { 
  requireTenantContext, 
  verifyTenantAccess, 
  createNotFoundResponse,
  logSecurityEvent,
  TenantContext 
} from "../../../../middlewares/tenant-isolation"

/**
 * GET /admin/consultations/:id
 * Get consultation with tenant isolation
 */
export const GET = [
  authenticate(),
  requireTenantContext(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const tenantContext = (req as any).tenant_context as TenantContext

    try {
      const consultation = await consultationService.retrieveConsultation(id)
      
      // ENFORCE tenant isolation
      if (!consultation || consultation.business_id !== tenantContext.business_id) {
        if (consultation) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "consultation",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: consultation.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "consultation",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Consultation")
        return res.status(notFound.status).json(notFound.body)
      }
      
      // Get status history
      const statusHistory = await consultationService.listStatusEventsByConsultation(id)

      res.json({
        consultation: {
          ...consultation,
          status_history: statusHistory,
        },
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(500).json({
        message: "Failed to retrieve consultation",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

/**
 * PUT /admin/consultations/:id
 * Update consultation with tenant isolation
 */
export const PUT = [
  authenticate(),
  requireTenantContext(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const tenantContext = (req as any).tenant_context as TenantContext

    try {
      // First retrieve to check tenant isolation
      const existingConsultation = await consultationService.retrieveConsultation(id)
      
      // ENFORCE tenant isolation
      if (!existingConsultation || existingConsultation.business_id !== tenantContext.business_id) {
        if (existingConsultation) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "consultation",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: existingConsultation.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "consultation",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Consultation")
        return res.status(notFound.status).json(notFound.body)
      }
      
      const consultation = await consultationService.updateConsultation(id, req.body)
      res.json({ consultation })
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(400).json({
        message: "Failed to update consultation",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

/**
 * DELETE /admin/consultations/:id
 * Delete consultation with tenant isolation
 */
export const DELETE = [
  authenticate(),
  requireTenantContext(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const tenantContext = (req as any).tenant_context as TenantContext

    try {
      // First retrieve to check tenant isolation
      const existingConsultation = await consultationService.retrieveConsultation(id)
      
      // ENFORCE tenant isolation
      if (!existingConsultation || existingConsultation.business_id !== tenantContext.business_id) {
        if (existingConsultation) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "consultation",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: existingConsultation.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "consultation",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Consultation")
        return res.status(notFound.status).json(notFound.body)
      }
      
      await consultationService.deleteConsultation(id)
      res.status(204).send()
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(500).json({
        message: "Failed to delete consultation",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
