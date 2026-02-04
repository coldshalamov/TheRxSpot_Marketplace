import { model } from "@medusajs/framework/utils"

export const ClinicianAvailabilityException = model.define("clinician_availability_exception", {
  id: model.id().primaryKey(),
  clinician_id: model.text(),
  date: model.dateTime(),
  is_available: model.boolean().default(false),
  reason: model.text().nullable(),
})
