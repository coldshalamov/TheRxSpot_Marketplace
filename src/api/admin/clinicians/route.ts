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
      specialization,
      is_platform_clinician,
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
    if (is_platform_clinician !== undefined) {
      filters.is_platform_clinician = is_platform_clinician === "true"
    }

    // Specialization filter - search in specializations array
    if (specialization) {
      filters.specializations = { $contains: specialization }
    }

    // Pagination
    const take = parseInt(limit, 10)
    const skip = parseInt(offset, 10)

    try {
      const [clinicians, count] = await consultationService.listClinicians(
        filters,
        {
          skip,
          take,
          order: { created_at: "DESC" },
        }
      )

      res.json({
        clinicians,
        count,
        limit: take,
        offset: skip,
      })
    } catch (error) {
      res.status(500).json({
        message: "Failed to list clinicians",
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
      const body = (req.body ?? {}) as Record<string, any>
      const clinician = await consultationService.createClinician(body)
      res.status(201).json({ clinician })
    } catch (error) {
      res.status(400).json({
        message: "Failed to create clinician",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
