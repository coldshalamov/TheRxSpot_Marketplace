import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../modules/financials"

interface PayoutsQueryParams {
  business_id?: string
  status?: string
  limit?: string
  offset?: string
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const financialsService = req.scope.resolve(FINANCIALS_MODULE)
    const query = req.query as PayoutsQueryParams

    // Parse pagination
    const limit = parseInt(query.limit ?? "20", 10)
    const offset = parseInt(query.offset ?? "0", 10)

    // Build filters
    const filters: any = {}
    if (query.business_id) {
      filters.business_id = query.business_id
    }
    if (query.status) {
      filters.status = query.status
    }

    // Get payouts with pagination
    const [payouts, count] = await financialsService.listAndCountPayouts(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    res.json({
      payouts,
      count,
      pagination: {
        limit,
        offset,
        has_more: offset + payouts.length < count,
      },
    })
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payouts",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const financialsService = req.scope.resolve(FINANCIALS_MODULE)
    const { business_id, earning_entry_ids, payout_method } = req.body as {
      business_id: string
      earning_entry_ids: string[]
      payout_method?: string
    }

    if (!business_id || !earning_entry_ids || !Array.isArray(earning_entry_ids)) {
      return res.status(400).json({
        message: "business_id and earning_entry_ids are required",
      })
    }

    if (earning_entry_ids.length === 0) {
      return res.status(400).json({
        message: "earning_entry_ids cannot be empty",
      })
    }

    // Get current user from auth context
    const changedBy = (req as any).auth_context?.auth_identity_id ?? "admin"

    const payout = await financialsService.createPayout(
      business_id,
      earning_entry_ids,
      changedBy
    )

    res.status(201).json({ payout })
  } catch (error) {
    res.status(500).json({
      message: "Failed to create payout",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
