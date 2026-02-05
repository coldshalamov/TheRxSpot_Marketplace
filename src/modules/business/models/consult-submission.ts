import { model } from "@medusajs/framework/utils"

export const ConsultSubmission = model.define("consult_submission", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  location_id: model.text().nullable(),
  product_id: model.text(),
  /**
   * Non-PHI linkage to the Medusa customer record.
   * Used for concurrency safety and reliable reconciliation.
   */
  customer_id: model.text().nullable(),
  /**
   * Optional idempotency key (client-supplied).
   * Unique per (business_id, customer_id) when present.
   */
  idempotency_key: model.text().nullable(),
  customer_email: model.text(),
  customer_first_name: model.text(),
  customer_last_name: model.text(),
  customer_phone: model.text().nullable(),
  customer_dob: model.text().nullable(),
  eligibility_answers: model.json().default({}),
  status: model.enum(["pending", "approved", "rejected", "expired"]).default("pending"),
  consult_fee: model.bigNumber().nullable(),
  chief_complaint: model.text().nullable(),
  medical_history: model.json().nullable(),
  notes: model.text().nullable(),
  reviewed_by: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),
})
