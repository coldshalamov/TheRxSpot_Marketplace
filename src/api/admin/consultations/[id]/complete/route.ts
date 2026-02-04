import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"
import { CompleteConsultationData } from "../../../../../modules/consultation/service"

export const POST = [
  authenticate("user", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const {
      outcome,
      approved_medications,
      notes,
      assessment,
      plan,
      rejection_reason,
    } = req.body as CompleteConsultationData & { rejection_reason?: string }

    if (!outcome) {
      return res.status(400).json({
        message: "outcome is required (approved, rejected, or requires_followup)",
      })
    }

    const validOutcomes = ["approved", "rejected", "requires_followup"]
    if (!validOutcomes.includes(outcome)) {
      return res.status(400).json({
        message: `Invalid outcome. Must be one of: ${validOutcomes.join(", ")}`,
      })
    }

    // Get current user info from auth context
    const changedBy = (req as any).auth_context?.auth_identity_id as string | undefined

    try {
      const data: CompleteConsultationData = {
        outcome,
        approved_medications,
        notes,
        assessment,
        plan,
        rejection_reason,
      }

      const consultation = await consultationService.completeConsultation(
        id,
        data,
        changedBy
      )

      res.json({ consultation })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message })
        }
        if (error.message.includes("Cannot complete consultation")) {
          return res.status(400).json({ message: error.message })
        }
      }
      res.status(500).json({
        message: "Failed to complete consultation",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
