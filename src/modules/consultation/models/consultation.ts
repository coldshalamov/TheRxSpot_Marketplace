import { model } from "@medusajs/framework/utils"

export const Consultation = model.define("consultation", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  patient_id: model.text(),
  clinician_id: model.text().nullable(),
  mode: model.enum(["async_form", "video", "phone", "chat"]),
  status: model.enum(["draft", "scheduled", "in_progress", "completed", "incomplete", "no_show", "cancelled"]),
  scheduled_at: model.dateTime().nullable(),
  started_at: model.dateTime().nullable(),
  ended_at: model.dateTime().nullable(),
  duration_minutes: model.number().nullable(),
  chief_complaint: model.text().nullable(),
  medical_history: model.json().nullable(),
  assessment: model.text().nullable(),
  plan: model.text().nullable(),
  /**
   * Clinician-facing notes. In admin UI this is labeled "Clinician notes".
   */
  notes: model.text().nullable(),
  /**
   * Internal admin notes (not visible to patients).
   */
  admin_notes: model.text().nullable(),
  outcome: model.enum(["approved", "rejected", "pending", "requires_followup"]).nullable(),
  rejection_reason: model.text().nullable(),
  approved_medications: model.array().nullable(),
  originating_submission_id: model.text().nullable(),
  order_id: model.text().nullable(),
})
