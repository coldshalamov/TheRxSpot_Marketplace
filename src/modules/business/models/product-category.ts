import { model } from "@medusajs/framework/utils"

export const ProductCategory = model.define("business_product_category", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  parent_id: model.text().nullable(),
  name: model.text(),
  description: model.text().nullable(),
  image_url: model.text().nullable(),
  requires_consult: model.boolean().default(false),
  rank: model.number().default(0),
  is_active: model.boolean().default(true),
})
  .indexes([
    { on: ["business_id"], name: "idx_product_category_business" },
    { on: ["parent_id"], name: "idx_product_category_parent" },
    { on: ["business_id", "rank"], name: "idx_product_category_rank" },
  ])
