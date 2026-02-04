import { model } from "@medusajs/framework/utils"

export const EarningEntry = model.define("earning_entry", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  order_id: model.text(),
  line_item_id: model.text().nullable(),
  consultation_id: model.text().nullable(),
  type: model.enum(["product_sale", "consultation_fee", "shipping_fee", "platform_fee", "clinician_fee"]),
  description: model.text().default(""),
  
  // Financial amounts (stored in cents/smallest currency unit)
  gross_amount: model.bigNumber(),
  platform_fee: model.bigNumber(),
  payment_processing_fee: model.bigNumber(),
  net_amount: model.bigNumber(),
  clinician_fee: model.bigNumber().nullable(),
  
  // Status tracking
  status: model.enum(["pending", "available", "paid", "reversed"]).default("pending"),
  available_at: model.dateTime().nullable(),
  paid_at: model.dateTime().nullable(),
  payout_id: model.text().nullable(),
  
  // Additional metadata
  metadata: model.json().default({}),
})
