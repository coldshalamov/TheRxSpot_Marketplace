import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../modules/consultation"
import { z } from "zod"

const ListQuerySchema = z
  .object({
    status: z.string().min(1).optional(),
    limit: z.string().optional(),
    offset: z.string().optional(),
  })
  .passthrough()

/**
 * GET /store/consultations
 * List current customer's consultations
 * Requires authentication
 */
export const GET = [
  authenticate("customer", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any

    // Get customer ID from auth context
    const customerId = (req as any).auth_context?.actor_id
    if (!customerId) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    const business = (req as any).context?.business as { id?: string } | undefined
    if (!business?.id) {
      return res.status(400).json({ message: "Business context not found" })
    }

    const q = ListQuerySchema.parse(req.query ?? {})
    const status = q.status
    const take = Math.min(Math.max(parseInt(q.limit ?? "20", 10) || 20, 1), 100)
    const skip = Math.max(parseInt(q.offset ?? "0", 10) || 0, 0)

    try {
      const patient = await consultationService
        .getPatientByCustomerId(business.id, customerId)
        .catch(() => null)

      if (!patient) {
        return res.json({ consultations: [], count: 0, limit: take, offset: skip })
      }

      const filters: Record<string, unknown> = { patient_id: patient.id }
      if (status) {
        filters.status = status
      }

      const [consultations, count] = await consultationService.listConsultations(
        filters,
        {
          skip,
          take,
          order: { created_at: "DESC" },
        }
      )

      // Sanitize consultation data for patient view (remove sensitive fields)
      const sanitizedConsultations = consultations.map((c) =>
        sanitizeConsultationForPatient(c)
      )

      res.json({
        consultations: sanitizedConsultations,
        count,
        limit: take,
        offset: skip,
      })
    } catch (error) {
      res.status(500).json({
        message: "Failed to list consultations",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

/**
 * POST /store/consultations
 * Create a new consultation from form submission
 * Requires authentication
 */
export const POST = [
  authenticate("customer", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    // Single source of truth for consult intake is:
    // POST /store/businesses/:slug/consult
    return res.status(410).json({
      code: "ENDPOINT_DEPRECATED",
      message: "Use POST /store/businesses/:slug/consult for consultation intake",
    })
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
