import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../../../modules/consultation"

export const POST = [
  authenticate(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const { status, reason } = req.body as { status: string; reason?: string }

    if (!status) {
      return res.status(400).json({ message: "Status is required" })
    }

    // Get current user info from auth context
    const changedBy = (req as any).auth_context?.auth_identity_id as string | undefined

    try {
      const consultation = await consultationService.transitionStatus(
        id,
        status,
        changedBy,
        reason
      )

      res.json({ consultation })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message })
        }
        if (error.message.includes("Invalid status transition")) {
          return res.status(400).json({ message: error.message })
        }
      }
      res.status(500).json({
        message: "Failed to transition consultation status",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
