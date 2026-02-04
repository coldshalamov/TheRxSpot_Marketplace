import { model } from "@medusajs/framework/utils"

export const ProductCategory = model.define("business_product_category", {
  id: model.id().primaryKey(),
  name: model.text(),
  description: model.text().nullable(),
  image_url: model.text().nullable(),
  requires_consult: model.boolean().default(false),
  sort_order: model.number().default(0),
  is_active: model.boolean().default(true),
})
