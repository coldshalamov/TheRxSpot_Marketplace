import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../../../modules/financials"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const tenantContext = (req as any).tenant_context
    if (!tenantContext) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    const financialsService = req.scope.resolve(FINANCIALS_MODULE)
    const { id } = req.params

    const payout = await financialsService.retrievePayout(id)

    // Verify payout belongs to this tenant
    if (payout.business_id !== tenantContext.business_id) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Get linked earnings
    const earnings = await financialsService.listEarningEntries({
      payout_id: id,
    })

    res.json({
      payout,
      earnings,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ message: "Payout not found" })
    }
    res.status(500).json({
      message: "Failed to fetch payout",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
