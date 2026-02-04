import { model } from "@medusajs/framework/utils"

export const OrderStatusEvent = model.define("order_status_event", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  business_id: model.text(),
  from_status: model.text(),
  to_status: model.text(),
  triggered_by: model.text().nullable(),
  reason: model.text().nullable(),
  metadata: model.json().nullable(),
})
