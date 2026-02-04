import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../../../modules/financials"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const tenantContext = (req as any).tenant_context
    if (!tenantContext) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    const financialsService = req.scope.resolve(FINANCIALS_MODULE)

    const summary = await financialsService.getEarningsSummary(
      tenantContext.business_id
    )

    res.json(summary)
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch earnings summary",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
