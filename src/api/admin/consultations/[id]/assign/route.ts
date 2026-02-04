import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../../../modules/consultation"

export const POST = [
  authenticate(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const { clinician_id } = req.body as { clinician_id: string }

    if (!clinician_id) {
      return res.status(400).json({ message: "clinician_id is required" })
    }

    try {
      const consultation = await consultationService.assignClinician(id, clinician_id)

      // Log the assignment as a status event
      const changedBy = (req as any).auth_context?.auth_identity_id as string | undefined
      await consultationService.createConsultationStatusEvents({
        consultation_id: id,
        from_status: consultation.status,
        to_status: consultation.status,
        changed_by: changedBy ?? null,
        reason: `Assigned to clinician: ${clinician_id}`,
        metadata: { clinician_id },
      })

      res.json({ consultation })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message })
        }
      }
      res.status(400).json({
        message: "Failed to assign clinician",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
