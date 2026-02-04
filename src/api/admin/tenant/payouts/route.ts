import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../../modules/financials"

interface PayoutsQueryParams {
  status?: string
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
    const query = req.query as PayoutsQueryParams

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
    const tenantContext = (req as any).tenant_context
    if (!tenantContext) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    const financialsService = req.scope.resolve(FINANCIALS_MODULE)
    const { earning_entry_ids } = req.body as {
      earning_entry_ids: string[]
    }

    if (!earning_entry_ids || !Array.isArray(earning_entry_ids)) {
      return res.status(400).json({
        message: "earning_entry_ids is required and must be an array",
      })
    }

    if (earning_entry_ids.length === 0) {
      return res.status(400).json({
        message: "earning_entry_ids cannot be empty",
      })
    }

    // Get current user from auth context
    const changedBy = (req as any).auth_context?.auth_identity_id ?? null

    const payout = await financialsService.createPayout(
      tenantContext.business_id,
      earning_entry_ids,
      changedBy
    )

    res.status(201).json({ payout })
  } catch (error) {
    res.status(500).json({
      message: "Failed to create payout request",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
