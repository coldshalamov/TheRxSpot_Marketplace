import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"

/**
 * GET /admin/tenant/consultations/:id
 * Get consultation detail for tenant's business
 */
export const GET = [
  authenticate("user", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const tenantContext = (req as any).tenant_context
    const { id } = req.params

    if (!tenantContext?.business_id) {
      return res.status(401).json({ message: "Not authenticated as tenant user" })
    }

    try {
      const consultation = await consultationService.getConsultationOrThrow(id)

      // Verify the consultation belongs to tenant's business
      if (consultation.business_id !== tenantContext.business_id) {
        return res.status(403).json({
          message: "Access denied. Consultation does not belong to your business.",
        })
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
 * PUT /admin/tenant/consultations/:id
 * Update consultation for tenant's business
 */
export const PUT = [
  authenticate("user", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const tenantContext = (req as any).tenant_context
    const { id } = req.params

    if (!tenantContext?.business_id) {
      return res.status(401).json({ message: "Not authenticated as tenant user" })
    }

    try {
      const consultation = await consultationService.getConsultationOrThrow(id)

      // Verify the consultation belongs to tenant's business
      if (consultation.business_id !== tenantContext.business_id) {
        return res.status(403).json({
          message: "Access denied. Consultation does not belong to your business.",
        })
      }

      // Prevent changing business_id
      const updateData = { ...((req.body ?? {}) as Record<string, any>) }
      delete updateData.business_id

      const updated = await consultationService.updateConsultation(id, updateData)
      res.json({ consultation: updated })
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
