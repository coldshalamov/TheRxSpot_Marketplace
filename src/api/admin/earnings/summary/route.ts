import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../../modules/financials"

interface SummaryQueryParams {
  period?: "day" | "week" | "month" | "year"
  date_from?: string
  date_to?: string
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const financialsService = req.scope.resolve(FINANCIALS_MODULE)
    const query = req.query as SummaryQueryParams

    // Get platform-wide summary
    const summary = await financialsService.getPlatformEarningsSummary()

    // Get earnings by period if requested
    let earningsByPeriod: Array<{ period: string; gross: number; net: number }> = []
    if (query.period) {
      const dateFrom = query.date_from ? new Date(query.date_from) : undefined
      const dateTo = query.date_to ? new Date(query.date_to) : undefined
      earningsByPeriod = await financialsService.getEarningsByPeriod(
        query.period,
        dateFrom,
        dateTo
      )
    }

    res.json({
      ...summary,
      earnings_by_period: earningsByPeriod,
    })
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch earnings summary",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
