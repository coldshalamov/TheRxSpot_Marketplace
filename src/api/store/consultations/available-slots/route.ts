import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONSULTATION_MODULE } from "../../../../modules/consultation"

/**
 * GET /store/consultations/available-slots
 * Get available appointment slots for booking
 * Public endpoint - no authentication required
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const consultationService = req.scope.resolve(CONSULTATION_MODULE)

  const {
    clinician_id,
    date_from,
    date_to,
    business_id,
  } = req.query as Record<string, string | undefined>

  // Validate required parameters
  if (!date_from || !date_to) {
    return res.status(400).json({
      message: "date_from and date_to are required",
    })
  }

  const dateFrom = new Date(date_from)
  const dateTo = new Date(date_to)

  // Validate date range
  if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
    return res.status(400).json({
      message: "Invalid date format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)",
    })
  }

  if (dateFrom > dateTo) {
    return res.status(400).json({
      message: "date_from must be before date_to",
    })
  }

  try {
    let availableSlots: Array<{
      date: string
      slots: string[]
      clinician_id?: string
    }> = []

    if (clinician_id) {
      // Get slots for specific clinician
      const slots = await consultationService.getAvailableSlots(
        clinician_id,
        dateFrom,
        dateTo
      )

      availableSlots = slots.map((s) => ({
        date: s.date.toISOString(),
        slots: s.slots,
        clinician_id,
      }))
    } else {
      // Get business context if available
      const business = (req as any).context?.business
      const targetBusinessId = business_id || business?.id

      if (targetBusinessId) {
        // Get all active clinicians for the business
        const clinicians = await consultationService.listCliniciansByBusiness(
          targetBusinessId
        )

        // Collect slots from all clinicians
        for (const clinician of clinicians[0]) {
          const slots = await consultationService.getAvailableSlots(
            clinician.id,
            dateFrom,
            dateTo
          )

          for (const slot of slots) {
            availableSlots.push({
              date: slot.date.toISOString(),
              slots: slot.slots,
              clinician_id: clinician.id,
            })
          }
        }
      } else {
        // Get platform clinicians
        const platformClinicians = await consultationService.getPlatformClinicians()

        for (const clinician of platformClinicians[0]) {
          const slots = await consultationService.getAvailableSlots(
            clinician.id,
            dateFrom,
            dateTo
          )

          for (const slot of slots) {
            availableSlots.push({
              date: slot.date.toISOString(),
              slots: slot.slots,
              clinician_id: clinician.id,
            })
          }
        }
      }
    }

    res.json({
      available_slots: availableSlots,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
      clinician_id: clinician_id || null,
    })
  } catch (error) {
    res.status(500).json({
      message: "Failed to get available slots",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
