import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../../../modules/consultation"

/**
 * POST /store/consultations/:id/cancel
 * Patient cancellation of consultation
 * Requires authentication
 */
export const POST = [
  authenticate("customer", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const { reason } = req.body as { reason?: string }

    // Get customer ID from auth context
    const customerId = (req as any).auth_context?.actor_id
    if (!customerId) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    try {
      const consultation = await consultationService.retrieveConsultation(id)

      // Get patient record to verify ownership
      const patient = await consultationService.getPatientById(
        consultation.patient_id
      )

      if (!patient || patient.customer_id !== customerId) {
        return res.status(403).json({
          message: "Access denied. This consultation does not belong to you.",
        })
      }

      // Check if consultation can be cancelled by patient
      const cancellableStatuses = ["draft", "scheduled"]
      if (!cancellableStatuses.includes(consultation.status)) {
        return res.status(400).json({
          message: `Cannot cancel consultation with status "${consultation.status}". Only consultations in "draft" or "scheduled" status can be cancelled.`,
        })
      }

      // Cancel the consultation
      const updated = await consultationService.cancelConsultation(
        id,
        reason || "Cancelled by patient"
      )

      res.json({
        consultation: sanitizeConsultationForPatient(updated),
        message: "Consultation cancelled successfully",
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message })
        }
        if (error.message.includes("Invalid status transition")) {
          return res.status(400).json({ message: error.message })
        }
      }
      res.status(500).json({
        message: "Failed to cancel consultation",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

/**
 * Sanitize consultation data for patient view
 */
function sanitizeConsultationForPatient(consultation: any): any {
  return {
    id: consultation.id,
    status: consultation.status,
    mode: consultation.mode,
    scheduled_at: consultation.scheduled_at,
    started_at: consultation.started_at,
    ended_at: consultation.ended_at,
    duration_minutes: consultation.duration_minutes,
    chief_complaint: consultation.chief_complaint,
    outcome: consultation.outcome,
    clinician_id: consultation.clinician_id,
    created_at: consultation.created_at,
    updated_at: consultation.updated_at,
  }
}
