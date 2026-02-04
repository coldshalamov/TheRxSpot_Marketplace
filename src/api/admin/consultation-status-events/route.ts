import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../modules/consultation"

export const GET = [
  authenticate("user", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)

    // Parse query parameters
    const {
      consultation_id,
      date_from,
      date_to,
      limit = "50",
      offset = "0",
    } = req.query as Record<string, string | undefined>

    // Build filters
    const filters: Record<string, any> = {}

    if (consultation_id) {
      filters.consultation_id = consultation_id
    }

    // Date range filtering on created_at
    if (date_from || date_to) {
      filters.created_at = {}
      if (date_from) {
        filters.created_at.$gte = new Date(date_from)
      }
      if (date_to) {
        filters.created_at.$lte = new Date(date_to)
      }
    }

    // Pagination
    const take = parseInt(limit, 10)
    const skip = parseInt(offset, 10)

    try {
      const [events, count] = await consultationService.listStatusEvents(
        filters,
        {
          skip,
          take,
          order: { created_at: "DESC" },
        }
      )

      res.json({
        events,
        count,
        limit: take,
        offset: skip,
      })
    } catch (error) {
      res.status(500).json({
        message: "Failed to list consultation status events",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
