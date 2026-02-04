import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../../modules/financials"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const financialsService = req.scope.resolve(FINANCIALS_MODULE)
    const { id } = req.params

    const payout = await financialsService.retrievePayout(id)

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

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const financialsService = req.scope.resolve(FINANCIALS_MODULE)
    const { id } = req.params
    const { action } = req.body as { action?: string }

    const changedBy = (req as any).auth_context?.auth_identity_id ?? "admin"

    switch (action) {
      case "process": {
        const payout = await financialsService.processPayout(id, changedBy)
        return res.json({ payout })
      }
      case "cancel": {
        const { reason } = req.body as { reason?: string }
        const payout = await financialsService.cancelPayout(id, reason)
        return res.json({ payout })
      }
      default:
        return res.status(400).json({
          message: "Invalid action. Use 'process' or 'cancel'",
        })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ message: "Payout not found" })
    }
    res.status(500).json({
      message: "Failed to process payout action",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
