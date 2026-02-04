import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../modules/consultation"

/**
 * GET /store/consultations
 * List current customer's consultations
 * Requires authentication
 */
export const GET = [
  authenticate("customer", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)

    // Get customer ID from auth context
    const customerId = (req as any).auth_context?.actor_id
    if (!customerId) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    // Parse query parameters
    const { status, limit = "20", offset = "0" } = req.query as Record<
      string,
      string | undefined
    >

    // Build filters
    const filters: Record<string, any> = {
      patient_id: customerId, // Assuming patient_id maps to customer_id
    }

    if (status) {
      filters.status = status
    }

    // Pagination
    const take = parseInt(limit, 10)
    const skip = parseInt(offset, 10)

    try {
      // Get patient by customer_id first
      const patients = await consultationService.listPatients(
        { customer_id: customerId },
        { take: 1 }
      )

      if (!patients[0].length) {
        return res.json({ consultations: [], count: 0, limit: take, offset: skip })
      }

      const patientId = patients[0][0].id
      filters.patient_id = patientId

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
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const body = (req.body ?? {}) as Record<string, any>

    // Get customer ID from auth context
    const customerId = (req as any).auth_context?.actor_id
    if (!customerId) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    // Get business from tenant context
    const business = (req as any).context?.business
    if (!business) {
      return res.status(400).json({ message: "Business context not found" })
    }

    try {
      // Get or create patient record for this customer
      let patient = await consultationService.getPatientByEmail(
        business.id,
        (req as any).auth_context?.actor_email || ""
      )

      if (!patient) {
        // Create patient record from customer data
        patient = await consultationService.createPatient({
          business_id: business.id,
          customer_id: customerId,
          first_name: body.patient_first_name || "",
          last_name: body.patient_last_name || "",
          email: (req as any).auth_context?.actor_email || "",
          phone: body.patient_phone || null,
          date_of_birth: body.patient_date_of_birth
            ? new Date(body.patient_date_of_birth)
            : null,
          gender: body.patient_gender || null,
        })
      }

      // Create consultation
      const consultation = await consultationService.createConsultation({
        business_id: business.id,
        patient_id: patient.id,
        mode: body.mode || "async_form",
        status: "draft",
        chief_complaint: body.chief_complaint || null,
        medical_history: body.medical_history || null,
        originating_submission_id: body.submission_id || null,
      })

      res.status(201).json({
        consultation: sanitizeConsultationForPatient(consultation),
      })
    } catch (error) {
      res.status(400).json({
        message: "Failed to create consultation",
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
