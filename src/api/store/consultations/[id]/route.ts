import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../modules/consultation"

/**
 * GET /store/consultations/:id
 * Get consultation detail (patient view - limited fields)
 * Requires authentication
 */
export const GET = [
  authenticate("customer", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params

    // Get customer ID from auth context
    const customerId = (req as any).auth_context?.actor_id
    if (!customerId) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    try {
      const consultation = await consultationService.getConsultationOrThrow(id)

      // Get patient record to verify ownership
      const patient = await consultationService.getPatientById(
        consultation.patient_id
      )

      if (!patient || patient.customer_id !== customerId) {
        return res.status(403).json({
          message: "Access denied. This consultation does not belong to you.",
        })
      }

      res.json({
        consultation: sanitizeConsultationForPatient(consultation),
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
 * Sanitize consultation data for patient view
 * Remove internal fields that patients shouldn't see
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
    // Include limited clinician info
    clinician_id: consultation.clinician_id,
    // Exclude internal notes, full medical history, etc.
    created_at: consultation.created_at,
    updated_at: consultation.updated_at,
  }
}
