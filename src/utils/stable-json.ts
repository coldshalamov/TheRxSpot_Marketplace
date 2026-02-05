/**
 * Stable JSON stringify (deterministic key ordering).
 *
 * Used for HMAC signing where we need canonical JSON without relying on raw bodies.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    (value as any).constructor === Object
  )
}

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort()
    const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    return `{${entries.join(",")}}`
  }

  // For Dates, Buffers, etc., JSON.stringify has reasonable semantics.
  return JSON.stringify(value)
}

