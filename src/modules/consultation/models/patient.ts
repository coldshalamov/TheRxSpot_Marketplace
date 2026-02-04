import { model } from "@medusajs/framework/utils"
import { encryptField, decryptField } from "../../utils/encryption"

/**
 * Patient Model
 * 
 * All PHI (Protected Health Information) fields are encrypted at rest
 * using AES-256-GCM encryption for HIPAA compliance.
 * 
 * Encrypted fields:
 * - first_name
 * - last_name
 * - email
 * - phone
 * - emergency_contact_name
 * - emergency_contact_phone
 * 
 * Note: date_of_birth, medical_history, allergies, and medications
 * are stored as JSON/array types which require special handling for encryption.
 * These should be encrypted at the application layer before storage.
 */

export const Patient = model.define("patient", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  customer_id: model.text().nullable(),
  
  // PHI Fields - Encrypted at rest
  first_name: model.text().transform({
    onSave: encryptField,
    onLoad: decryptField,
  }),
  last_name: model.text().transform({
    onSave: encryptField,
    onLoad: decryptField,
  }),
  email: model.text().transform({
    onSave: encryptField,
    onLoad: decryptField,
  }),
  phone: model.text().nullable().transform({
    onSave: encryptField,
    onLoad: decryptField,
  }),
  
  // Date of birth - stored as ISO string and encrypted
  date_of_birth: model.text().nullable().transform({
    onSave: (value) => {
      if (!value) return value
      // Handle Date objects or ISO strings
      const dateStr = value instanceof Date ? value.toISOString() : String(value)
      return encryptField(dateStr)
    },
    onLoad: (value) => {
      if (!value) return value
      const decrypted = decryptField(value)
      // Return as Date object for consistency
      return decrypted ? new Date(decrypted) : null
    },
  }),
  
  gender: model.text().nullable(),
  
  // Complex PHI fields - encrypted as JSON strings
  medical_history: model.text().nullable().transform({
    onSave: (value) => {
      if (!value) return value
      // Encrypt the JSON string representation
      return encryptField(JSON.stringify(value))
    },
    onLoad: (value) => {
      if (!value) return value
      const decrypted = decryptField(value)
      try {
        return decrypted ? JSON.parse(decrypted) : null
      } catch {
        return decrypted
      }
    },
  }),
  
  allergies: model.text().nullable().transform({
    onSave: (value) => {
      if (!value) return value
      // Encrypt the JSON string representation of the array
      return encryptField(JSON.stringify(value))
    },
    onLoad: (value) => {
      if (!value) return value
      const decrypted = decryptField(value)
      try {
        return decrypted ? JSON.parse(decrypted) : null
      } catch {
        return decrypted
      }
    },
  }),
  
  medications: model.text().nullable().transform({
    onSave: (value) => {
      if (!value) return value
      // Encrypt the JSON string representation of the array
      return encryptField(JSON.stringify(value))
    },
    onLoad: (value) => {
      if (!value) return value
      const decrypted = decryptField(value)
      try {
        return decrypted ? JSON.parse(decrypted) : null
      } catch {
        return decrypted
      }
    },
  }),
  
  emergency_contact_name: model.text().nullable().transform({
    onSave: encryptField,
    onLoad: decryptField,
  }),
  emergency_contact_phone: model.text().nullable().transform({
    onSave: encryptField,
    onLoad: decryptField,
  }),
})
