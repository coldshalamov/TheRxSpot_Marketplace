/**
 * Encryption Utilities for PHI Field-Level Encryption
 * 
 * Implements AES-256-GCM encryption for HIPAA compliance.
 *
 * Output format (versioned, hex encoded):
 *   v1:<ivHex>:<tagHex>:<ciphertextHex>
 *
 * - `iv` is 12 bytes (recommended for GCM).
 * - `tag` is 16 bytes (GCM auth tag).
 * - `ciphertext` is variable-length.
 *
 * Key rotation:
 * - Encrypt uses the current key only.
 * - Decrypt tries the current key first, then any old keys.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const KEY_LENGTH_BYTES = 32
const IV_LENGTH_BYTES = 12
const TAG_LENGTH_BYTES = 16
const VERSION_PREFIX = "v1"

type Keychain = {
  currentKey: Buffer
  oldKeys: Buffer[]
}

let cachedKeychain: Keychain | null = null

function normalizeBase64(value: string): string {
  // Support base64url by normalizing to standard base64.
  return value.replace(/-/g, "+").replace(/_/g, "/")
}

function isHex(value: string): boolean {
  return /^[0-9a-fA-F]+$/.test(value)
}

function parse32ByteKey(value: string, varName: string): Buffer {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${varName} must not be empty.`)
  }

  // Prefer strict hex (64 chars => 32 bytes).
  if (isHex(trimmed)) {
    if (trimmed.length !== KEY_LENGTH_BYTES * 2) {
      throw new Error(
        `${varName} must be exactly ${KEY_LENGTH_BYTES} bytes (expected ${KEY_LENGTH_BYTES * 2} hex characters).`
      )
    }
    return Buffer.from(trimmed, "hex")
  }

  // Otherwise try base64 / base64url.
  const b64 = normalizeBase64(trimmed)
  const key = Buffer.from(b64, "base64")
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `${varName} must be exactly ${KEY_LENGTH_BYTES} bytes when decoded (hex or base64). Decoded length: ${key.length}.`
    )
  }
  return key
}

function parseKeyList(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) {
    return []
  }

  // Accept JSON array or comma-separated list.
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (!Array.isArray(parsed)) {
        throw new Error("must be a JSON array")
      }
      return parsed.map((v) => String(v)).map((v) => v.trim()).filter(Boolean)
    } catch (e) {
      throw new Error(`ENCRYPTION_KEY_OLD is invalid JSON: ${(e as Error).message}`)
    }
  }

  return trimmed.split(",").map((v) => v.trim()).filter(Boolean)
}

export function getEncryptionKeychainFromEnv(env: NodeJS.ProcessEnv = process.env): Keychain {
  const currentCandidate = env.ENCRYPTION_KEY_CURRENT ?? env.DATABASE_ENCRYPTION_KEY
  if (!currentCandidate || !currentCandidate.trim()) {
    throw new Error(
      "FATAL: Missing encryption key. Set ENCRYPTION_KEY_CURRENT (preferred) " +
        "or DATABASE_ENCRYPTION_KEY to a 32-byte key (hex or base64). " +
        "Generate a hex key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    )
  }

  const oldRaw =
    env.ENCRYPTION_KEY_OLD ?? env.DATABASE_ENCRYPTION_KEY_OLD ?? ""

  const currentKey = parse32ByteKey(
    currentCandidate,
    env.ENCRYPTION_KEY_CURRENT ? "ENCRYPTION_KEY_CURRENT" : "DATABASE_ENCRYPTION_KEY"
  )

  const oldKeys = parseKeyList(oldRaw).map((v, idx) =>
    parse32ByteKey(v, `ENCRYPTION_KEY_OLD[${idx}]`)
  )

  return { currentKey, oldKeys }
}

export function resetEncryptionKeychainCache(): void {
  cachedKeychain = null
}

function getCachedKeychain(): Keychain {
  if (!cachedKeychain) {
    cachedKeychain = getEncryptionKeychainFromEnv()
  }
  return cachedKeychain
}

function formatPayload(iv: Buffer, tag: Buffer, ciphertext: Buffer): string {
  return `${VERSION_PREFIX}:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`
}

function parsePayload(payload: string): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const trimmed = payload.trim()

  // Backward compatible: allow legacy iv:tag:ciphertext (no version prefix).
  const parts = trimmed.split(":")
  if (parts.length === 3) {
    const [ivHex, tagHex, cipherHex] = parts
    return {
      iv: Buffer.from(ivHex, "hex"),
      tag: Buffer.from(tagHex, "hex"),
      ciphertext: Buffer.from(cipherHex, "hex"),
    }
  }

  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error("Invalid encrypted payload format.")
  }

  const [, ivHex, tagHex, cipherHex] = parts
  return {
    iv: Buffer.from(ivHex, "hex"),
    tag: Buffer.from(tagHex, "hex"),
    ciphertext: Buffer.from(cipherHex, "hex"),
  }
}

/**
 * Encrypt a UTF-8 string using AES-256-GCM.
 */
export function encryptString(plaintext: string): string {
  const { currentKey } = getCachedKeychain()
  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv("aes-256-gcm", currentKey, iv, { authTagLength: TAG_LENGTH_BYTES })

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return formatPayload(iv, tag, ciphertext)
}

/**
 * Decrypt an encrypted payload created by {@link encryptString}.
 */
export function decryptString(payload: string): string {
  const { currentKey, oldKeys } = getCachedKeychain()
  const { iv, tag, ciphertext } = parsePayload(payload)

  const keysToTry = [currentKey, ...oldKeys]
  let lastErr: unknown = null

  for (const key of keysToTry) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_LENGTH_BYTES })
      decipher.setAuthTag(tag)
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
      return plaintext
    } catch (e) {
      lastErr = e
    }
  }

  const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(`Failed to decrypt payload with current/old keys. Last error: ${errMsg}`)
}

/**
 * Encrypt a field value (null/undefined passthrough).
 */
export function encryptField(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) {
    return value
  }
  return encryptString(value)
}

/**
 * Decrypt a field value (null/undefined passthrough).
 * If the value doesn't look encrypted, it's returned as-is.
 */
export function decryptField(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) {
    return value
  }
  if (!isEncrypted(value)) {
    return value
  }
  return decryptString(value)
}

export function isEncrypted(value: unknown): value is string {
  if (typeof value !== "string") {
    return false
  }
  const trimmed = value.trim()
  const parts = trimmed.split(":")

  if (parts.length === 3) {
    return parts.every((p) => isHex(p) && p.length >= 2)
  }

  if (parts.length === 4 && parts[0] === VERSION_PREFIX) {
    return isHex(parts[1]) && isHex(parts[2]) && isHex(parts[3])
  }

  return false
}

/**
 * Minimal reusable "decorator-like" helper for encrypting/decrypting selected fields.
 * This is intended for service-layer usage (Medusa's DML doesn't support per-field transforms).
 */
export function encryptFields<T extends Record<string, any>>(
  input: T,
  fields: readonly (keyof T)[]
): T {
  const out = { ...input }
  for (const field of fields) {
    const value = out[field]
    if (value === null || value === undefined) {
      continue
    }
    if (typeof value === "string") {
      out[field] = encryptString(value) as any
      continue
    }
    if ((value as any) instanceof Date) {
      out[field] = encryptString(value.toISOString()) as any
      continue
    }
    out[field] = encryptString(JSON.stringify(value)) as any
  }
  return out
}

export function decryptFields<T extends Record<string, any>>(
  input: T,
  fields: readonly (keyof T)[]
): T {
  const out = { ...input }
  for (const field of fields) {
    const value = out[field]
    if (typeof value !== "string") {
      continue
    }
    if (!isEncrypted(value)) {
      continue
    }
    const decrypted = decryptString(value)
    // Best-effort JSON parse for fields that were stringified.
    if (decrypted.startsWith("{") || decrypted.startsWith("[")) {
      try {
        out[field] = JSON.parse(decrypted) as any
        continue
      } catch {
        // fall through
      }
    }
    out[field] = decrypted as any
  }
  return out
}
