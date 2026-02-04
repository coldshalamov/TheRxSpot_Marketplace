import { model } from "@medusajs/framework/utils"

/**
 * Patient Model
 * 
 * All PHI (Protected Health Information) fields must be encrypted at rest
 * using AES-256-GCM encryption for HIPAA compliance.
 * 
 * Encrypted fields (service-layer encryption; model-level transforms aren't supported):
 * - first_name
 * - last_name
 * - email
 * - phone
 * - emergency_contact_name
 * - emergency_contact_phone
 * 
 * Note: date_of_birth, medical_history, allergies, and medications
 * are stored as text and should be JSON-stringified/encrypted at the application layer before storage.
 */

export const Patient = model.define("patient", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  customer_id: model.text().nullable(),
  
  first_name: model.text(),
  last_name: model.text(),
  email: model.text(),
  phone: model.text().nullable(),
  date_of_birth: model.text().nullable(),
  
  gender: model.text().nullable(),
  
  medical_history: model.text().nullable(),
  allergies: model.text().nullable(),
  medications: model.text().nullable(),
  
  emergency_contact_name: model.text().nullable(),
  emergency_contact_phone: model.text().nullable(),
})
