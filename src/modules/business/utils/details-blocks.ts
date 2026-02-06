type DetailsBlockType = "heading" | "paragraph" | "list" | "cta" | "image"

export type DetailsBlock = {
  id: string
  type: DetailsBlockType
  data: Record<string, any>
}

function toTrimmedString(value: unknown, maxLen: number): string {
  const text = String(value ?? "").trim()
  return text.length > maxLen ? text.slice(0, maxLen) : text
}

function sanitizeUrl(value: unknown): string {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  try {
    const u = new URL(raw)
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.toString()
    }
  } catch {
    return ""
  }
  return ""
}

function sanitizeListItems(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => toTrimmedString(item, 220))
    .filter(Boolean)
    .slice(0, 20)
}

function sanitizeBlock(block: any, index: number): DetailsBlock | null {
  if (!block || typeof block !== "object") return null

  const type = toTrimmedString(block.type, 24) as DetailsBlockType
  const id = toTrimmedString(block.id || `block_${index + 1}`, 64) || `block_${index + 1}`
  const data = block.data && typeof block.data === "object" ? block.data : {}

  if (type === "heading") {
    const text = toTrimmedString(data.text, 180)
    if (!text) return null
    return { id, type, data: { text } }
  }

  if (type === "paragraph") {
    const text = toTrimmedString(data.text, 4000)
    if (!text) return null
    return { id, type, data: { text } }
  }

  if (type === "list") {
    const heading = toTrimmedString(data.heading, 180)
    const items = sanitizeListItems(data.items)
    if (!heading && !items.length) return null
    return { id, type, data: { heading, items } }
  }

  if (type === "cta") {
    const label = toTrimmedString(data.label, 80)
    const url = sanitizeUrl(data.url)
    const text = toTrimmedString(data.text, 500)
    if (!label && !text) return null
    return { id, type, data: { label, url, text } }
  }

  if (type === "image") {
    const url = sanitizeUrl(data.url)
    const alt = toTrimmedString(data.alt, 140)
    const caption = toTrimmedString(data.caption, 320)
    if (!url) return null
    return { id, type, data: { url, alt, caption } }
  }

  return null
}

export function sanitizeDetailsBlocks(input: unknown): DetailsBlock[] {
  if (!Array.isArray(input)) return []
  return input.map((block, index) => sanitizeBlock(block, index)).filter(Boolean) as DetailsBlock[]
}
