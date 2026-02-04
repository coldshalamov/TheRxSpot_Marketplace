import { model } from "@medusajs/framework/utils"

export const Business = model.define("business", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text().unique(),
  logo_url: model.text().nullable(),
  primary_color: model.text().nullable(),
  secondary_color: model.text().nullable(),
  custom_html_head: model.text().nullable(),
  custom_html_body: model.text().nullable(),
  domain: model.text().nullable().unique(),
  is_active: model.boolean().default(true),
  status: model.enum(["pending", "approved", "active", "suspended"]).default("pending"),
  branding_config: model.json().default({}),
  domain_config: model.json().default({}),
  catalog_config: model.json().default({}),
  settings: model.json().default({}),
  sales_channel_id: model.text().nullable(),
  publishable_api_key_id: model.text().nullable(),
})
