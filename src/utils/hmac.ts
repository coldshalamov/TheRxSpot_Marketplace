import { createHmac, timingSafeEqual } from "crypto"

export function sha256HmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex")
}

export function normalizeHexSignature(sig: string): string {
  const trimmed = sig.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("sha256=")) {
    return trimmed.slice("sha256=".length)
  }
  return trimmed
}

export function safeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, "hex")
    const b = Buffer.from(bHex, "hex")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

