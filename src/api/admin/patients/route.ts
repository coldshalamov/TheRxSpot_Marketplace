import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../modules/consultation"

export const GET = [
  authenticate(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)

    // Parse query parameters
    const {
      business_id,
      email,
      limit = "50",
      offset = "0",
    } = req.query as Record<string, string | undefined>

    // Build filters
    const filters: Record<string, any> = {}

    if (business_id) {
      filters.business_id = business_id
    }
    if (email) {
      filters.email = email
    }

    // Pagination
    const take = parseInt(limit, 10)
    const skip = parseInt(offset, 10)

    try {
      const [patients, count] = await consultationService.listPatients(
        filters,
        {
          skip,
          take,
          order: { created_at: "DESC" },
        }
      )

      res.json({
        patients,
        count,
        limit: take,
        offset: skip,
      })
    } catch (error) {
      res.status(500).json({
        message: "Failed to list patients",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

export const POST = [
  authenticate(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)

    try {
      const patient = await consultationService.createPatient(req.body)
      res.status(201).json({ patient })
    } catch (error) {
      res.status(400).json({
        message: "Failed to create patient",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
