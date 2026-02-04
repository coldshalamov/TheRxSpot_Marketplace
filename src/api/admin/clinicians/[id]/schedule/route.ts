import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../../../modules/consultation"

/**
 * GET /admin/clinicians/:id/schedule
 * Get clinician's upcoming schedule (consultations)
 */
export const GET = [
  authenticate(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const { date_from, date_to } = req.query as Record<string, string | undefined>

    try {
      // Verify clinician exists
      await consultationService.retrieveClinician(id)

      // Parse date range
      const dateFrom = date_from ? new Date(date_from) : undefined
      const dateTo = date_to ? new Date(date_to) : undefined

      // Get clinician's schedule (consultations)
      const [consultations] = await consultationService.getClinicianSchedule(
        id,
        dateFrom,
        dateTo
      )

      res.json({
        clinician_id: id,
        date_from: dateFrom?.toISOString(),
        date_to: dateTo?.toISOString(),
        consultations,
        count: consultations.length,
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(500).json({
        message: "Failed to get clinician schedule",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
