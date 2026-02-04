import { model } from "@medusajs/framework/utils"

export const Location = model.define("location", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  name: model.text(),
  phone: model.text(),
  email: model.text().nullable(),
  address: model.text().nullable(),
  city: model.text().nullable(),
  state: model.text().nullable(),
  zip: model.text().nullable(),
  serviceable_states: model.array().default([]),
  is_active: model.boolean().default(true),
})
