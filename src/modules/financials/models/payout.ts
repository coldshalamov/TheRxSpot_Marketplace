import { model } from "@medusajs/framework/utils"

export const Payout = model.define("payout", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  
  // Payout amounts
  total_amount: model.bigNumber(),
  fee_amount: model.bigNumber(),
  net_amount: model.bigNumber(),
  
  // Status tracking
  status: model.enum(["pending", "processing", "completed", "failed"]).default("pending"),
  
  // Payout method info
  method: model.enum(["ach", "wire", "check", "stripe_connect"]).default("stripe_connect"),
  destination_account: model.text().nullable(), // Stripe Connect account ID or bank reference
  
  // Processing timestamps
  requested_at: model.dateTime(),
  processed_at: model.dateTime().nullable(),
  completed_at: model.dateTime().nullable(),
  
  // External reference
  transaction_id: model.text().nullable(),
  
  // Failure handling
  failure_reason: model.text().nullable(),
  
  // Linked earning entries (stored as JSON array of IDs)
  earning_entries: model.json().default([] as any),
  
  // Metadata
  metadata: model.json().default({}),
})
