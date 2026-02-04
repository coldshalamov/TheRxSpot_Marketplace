import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"

/**
 * GET /admin/clinicians/:id/availability
 * Get clinician's availability schedule
 */
export const GET = [
  authenticate("user", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params

    try {
      // Verify clinician exists
      await consultationService.getClinicianOrThrow(id)

      // Get availability (this would come from a separate table in a full implementation)
      const availability = await consultationService.getClinicianAvailability(id)

      res.json({
        clinician_id: id,
        availability,
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(500).json({
        message: "Failed to get clinician availability",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

/**
 * POST /admin/clinicians/:id/availability
 * Set clinician's availability schedule
 */
export const POST = [
  authenticate("user", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const { id } = req.params
    const { schedule } = req.body as { schedule: any[] }

    if (!schedule || !Array.isArray(schedule)) {
      return res.status(400).json({
        message: "schedule array is required",
      })
    }

    // Validate schedule entries
    for (const entry of schedule) {
      if (
        typeof entry.day_of_week !== "number" ||
        !entry.start_time ||
        !entry.end_time ||
        typeof entry.is_available !== "boolean"
      ) {
        return res.status(400).json({
          message:
            "Each schedule entry must have day_of_week (number), start_time, end_time, and is_available (boolean)",
        })
      }
      if (entry.day_of_week < 0 || entry.day_of_week > 6) {
        return res.status(400).json({
          message: "day_of_week must be between 0 (Sunday) and 6 (Saturday)",
        })
      }
    }

    try {
      await consultationService.setClinicianAvailability(id, schedule)

      res.json({
        clinician_id: id,
        schedule,
        message: "Availability schedule updated successfully",
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message })
      }
      res.status(500).json({
        message: "Failed to set clinician availability",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
