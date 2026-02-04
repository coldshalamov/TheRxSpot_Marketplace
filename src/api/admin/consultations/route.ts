import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../modules/consultation"

export const GET = [
  authenticate("user", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)

    // Parse query parameters
    const {
      business_id,
      status,
      clinician_id,
      patient_id,
      date_from,
      date_to,
      mode,
      outcome,
      limit = "50",
      offset = "0",
    } = req.query as Record<string, string | undefined>

    // Build filters
    const filters: Record<string, any> = {}

    if (business_id) {
      filters.business_id = business_id
    }
    if (status) {
      filters.status = status
    }
    if (clinician_id) {
      filters.clinician_id = clinician_id
    }
    if (patient_id) {
      filters.patient_id = patient_id
    }
    if (mode) {
      filters.mode = mode
    }
    if (outcome) {
      filters.outcome = outcome
    }

    // Date range filtering on scheduled_at
    if (date_from || date_to) {
      filters.scheduled_at = {}
      if (date_from) {
        filters.scheduled_at.$gte = new Date(date_from)
      }
      if (date_to) {
        filters.scheduled_at.$lte = new Date(date_to)
      }
    }

    // Pagination
    const take = parseInt(limit, 10)
    const skip = parseInt(offset, 10)

    try {
      const [consultations, count] = await consultationService.listConsultations(
        filters,
        {
          skip,
          take,
          order: { created_at: "DESC" },
        }
      )

      res.json({
        consultations,
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

export const POST = [
  authenticate("user", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)

    try {
      const consultation = await consultationService.createConsultation(req.body)
      res.status(201).json({ consultation })
    } catch (error) {
      res.status(400).json({
        message: "Failed to create consultation",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
