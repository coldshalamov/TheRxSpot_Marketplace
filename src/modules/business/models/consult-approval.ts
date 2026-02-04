import { model } from "@medusajs/framework/utils"

export const ConsultApproval = model.define("consult_approval", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  product_id: model.text(),
  business_id: model.text(),
  status: model.enum(["pending", "approved", "rejected", "expired"]).default("pending"),
  consultation_id: model.text().nullable(),
  approved_by: model.text().nullable(),
  approved_at: model.dateTime().nullable(),
  expires_at: model.dateTime().nullable(),
})
