import { model } from "@medusajs/framework/utils"

export const Coupon = model.define("coupon", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  code: model.text(),
  type: model.enum(["percentage", "fixed_amount", "free_shipping"]).default("percentage"),
  value: model.number().default(0),
  min_order_amount: model.number().nullable(),
  max_discount_amount: model.number().nullable(),
  usage_limit: model.number().nullable(),
  usage_count: model.number().default(0),
  per_customer_limit: model.number().nullable(),
  is_active: model.boolean().default(true),
  starts_at: model.dateTime().nullable(),
  ends_at: model.dateTime().nullable(),
  applies_to: model.json().default({}),
  metadata: model.json().default({}),
})
