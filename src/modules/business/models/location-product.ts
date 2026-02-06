import { model } from "@medusajs/framework/utils"

export const LocationProduct = model.define("location_product", {
  id: model.id().primaryKey(),
  location_id: model.text(),
  product_id: model.text(),
  category_id: model.text().nullable(),
  is_active: model.boolean().default(true),
  custom_price: model.number().nullable(),
  display_title: model.text().nullable(),
  display_description: model.text().nullable(),
  display_image_url: model.text().nullable(),
  details_blocks: model.json().nullable(),
  rank: model.number().default(0),
})
  .indexes([
    { on: ["location_id"], name: "idx_location_product_location" },
    { on: ["product_id"], name: "idx_location_product_product" },
    { on: ["location_id", "product_id"], unique: true, name: "idx_location_product_unique" },
    { on: ["location_id", "category_id", "rank"], name: "idx_location_product_rank" },
  ])
