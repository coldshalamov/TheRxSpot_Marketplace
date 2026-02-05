import { model } from "@medusajs/framework/utils"

export const BusinessDomain = model.define("business_domain", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  domain: model.text().unique(),
  is_primary: model.boolean().default(false),
  is_verified: model.boolean().default(false),
  verified_at: model.dateTime().nullable(),
  last_checked_at: model.dateTime().nullable(),
  dns_error: model.text().nullable(),
})
