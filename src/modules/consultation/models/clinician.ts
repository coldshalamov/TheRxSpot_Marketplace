import { model } from "@medusajs/framework/utils"

export const Clinician = model.define("clinician", {
  id: model.id().primaryKey(),
  business_id: model.text().nullable(),
  user_id: model.text().nullable(),
  first_name: model.text(),
  last_name: model.text(),
  email: model.text(),
  phone: model.text().nullable(),
  npi_number: model.text().nullable(),
  license_number: model.text(),
  license_state: model.text(),
  license_expiry: model.dateTime(),
  credentials: model.array(),
  specializations: model.array(),
  status: model.enum(["active", "inactive", "suspended"]),
  is_platform_clinician: model.boolean().default(false),
  timezone: model.text(),
})
