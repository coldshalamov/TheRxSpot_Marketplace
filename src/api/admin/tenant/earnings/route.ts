import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../../modules/financials"

interface EarningsQueryParams {
  status?: string
  type?: string
  date_from?: string
  date_to?: string
  limit?: string
  offset?: string
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const tenantContext = (req as any).tenant_context
    if (!tenantContext) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    const financialsService = req.scope.resolve(FINANCIALS_MODULE)
    const query = req.query as EarningsQueryParams

    // Parse pagination
    const limit = parseInt(query.limit ?? "20", 10)
    const offset = parseInt(query.offset ?? "0", 10)

    // Build filters - always filter by tenant's business
    const filters: any = {
      business_id: tenantContext.business_id,
    }
    if (query.status) {
      filters.status = query.status
    }
    if (query.type) {
      filters.type = query.type
    }
    if (query.date_from || query.date_to) {
      filters.created_at = {}
      if (query.date_from) {
        filters.created_at.$gte = new Date(query.date_from)
      }
      if (query.date_to) {
        filters.created_at.$lte = new Date(query.date_to)
      }
    }

    // Get earnings with pagination
    const [earnings, count] = await financialsService.listAndCountEarningEntries(
      filters,
      {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      }
    )

    res.json({
      earnings,
      count,
      pagination: {
        limit,
        offset,
        has_more: offset + earnings.length < count,
      },
    })
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch earnings",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
