import { model } from "@medusajs/framework/utils"

/**
 * OutboxEvent
 *
 * Durable, retryable event record to guarantee "no lost dispatches" when
 * sending cases/orders to external partners.
 */
export const OutboxEvent = model.define("outbox_event", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  type: model.text(),
  dedupe_key: model.text().unique(),

  status: model.enum(["pending", "delivered", "dead_letter"]).default("pending"),
  attempts: model.number().default(0),
  next_attempt_at: model.dateTime().nullable(),
  delivered_at: model.dateTime().nullable(),
  last_error: model.text().nullable(),

  payload: model.json().default({}),
  metadata: model.json().default({}),
})

