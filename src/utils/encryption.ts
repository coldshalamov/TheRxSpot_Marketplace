/**
 * Encryption Utilities for PHI Field-Level Encryption
 * 
 * Implements AES-256-GCM encryption for HIPAA compliance.
 * All PHI fields must be encrypted at rest.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

const ENCRYPTION_KEY = process.env.DATABASE_ENCRYPTION_KEY
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Get the encryption key from environment
 */
function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error(
      "DATABASE_ENCRYPTION_KEY environment variable is not set. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    )
  }
  // Use SHA-256 to derive a 32-byte key from the provided key
  return createHash("sha256").update(ENCRYPTION_KEY).digest()
}

/**
 * Encrypt a field value using AES-256-GCM
 * Format: iv:authTag:encryptedData (all hex encoded)
 */
export function encryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return value as null
  }

  const iv = randomBytes(IV_LENGTH)
  const key = getEncryptionKey()
  const cipher = createCipheriv("aes-256-gcm", key, iv)

  let encrypted = cipher.update(value, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag()

  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted
}

/**
 * Decrypt a field value using AES-256-GCM
 * Expects format: iv:authTag:encryptedData (all hex encoded)
 */
export function decryptField(encryptedValue: string | null | undefined): string | null {
  if (encryptedValue === null || encryptedValue === undefined) {
    return encryptedValue as null
  }

  // Check if the value is encrypted (contains colons)
  if (!encryptedValue.includes(":")) {
    // Value is not encrypted, return as-is
    return encryptedValue
  }

  const parts = encryptedValue.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format")
  }

  const [ivHex, authTagHex, encrypted] = parts
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const key = getEncryptionKey()

  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") {
    return false
  }
  // Encrypted values have format: iv:authTag:encryptedData
  const parts = value.split(":")
  if (parts.length !== 3) {
    return false
  }
  // Validate hex encoding
  const hexPattern = /^[a-f0-9]+$/i
  return parts.every(part => hexPattern.test(part) && part.length >= 16)
}

/**
 * Transform function for Medusa model text fields
 * Encrypts on save, decrypts on load
 */
export const encryptionTransform = {
  onSave: encryptField,
  onLoad: decryptField,
}
