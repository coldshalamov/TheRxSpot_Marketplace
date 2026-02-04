import { model } from "@medusajs/framework/utils"

export const ClinicianSchedule = model.define("clinician_schedule", {
  id: model.id().primaryKey(),
  clinician_id: model.text(),
  day_of_week: model.number(),
  start_time: model.text(),
  end_time: model.text(),
  is_available: model.boolean().default(true),
  effective_from: model.dateTime(),
  effective_to: model.dateTime().nullable(),
})
