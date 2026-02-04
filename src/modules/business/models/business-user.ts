import { model } from "@medusajs/framework/utils"

export const BusinessUser = model.define("business_user", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  email: model.text(),
  role: model.enum(["owner", "staff", "viewer"]).default("staff"),
  auth_identity_id: model.text().nullable(),
  is_active: model.boolean().default(true),
})
