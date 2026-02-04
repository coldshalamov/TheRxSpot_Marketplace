import { model } from "@medusajs/framework/utils"

export const ConsultationStatusEvent = model.define("consultation_status_event", {
  id: model.id().primaryKey(),
  consultation_id: model.text(),
  from_status: model.text().nullable(),
  to_status: model.text(),
  changed_by: model.text().nullable(),
  reason: model.text().nullable(),
  metadata: model.json().nullable(),
})
