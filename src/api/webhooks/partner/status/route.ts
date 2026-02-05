import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"
import { COMPLIANCE_MODULE } from "../../../../modules/compliance"
import { stableStringify } from "../../../../utils/stable-json"
import { normalizeHexSignature, safeEqualHex, sha256HmacHex } from "../../../../utils/hmac"
import { z } from "zod"

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t ? t : null
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const signatureHeader = asString(req.headers["x-rxspot-signature"])
  const timestampHeader = asString(req.headers["x-rxspot-timestamp"])

  const secret =
    asString(process.env.PARTNER_STATUS_WEBHOOK_SECRET) ||
    asString(process.env.OUTBOX_SIGNING_SECRET)

  if (!secret || !signatureHeader || !timestampHeader) {
    res.status(401).json({ message: "Missing webhook auth headers" })
    return
  }

  const timestampMs = Number(timestampHeader)
  if (!Number.isFinite(timestampMs)) {
    res.status(400).json({ message: "Invalid timestamp" })
    return
  }

  const nowMs = Date.now()
  const maxSkewMs = 5 * 60_000
  if (Math.abs(nowMs - timestampMs) > maxSkewMs) {
    res.status(401).json({ message: "Webhook timestamp outside allowed window" })
    return
  }

  const bodyUnknown: unknown = req.body ?? {}
  const message = `${timestampHeader}.${stableStringify(bodyUnknown)}`
  const expected = sha256HmacHex(secret, message)
  const provided = normalizeHexSignature(signatureHeader)

  if (!safeEqualHex(expected, provided)) {
    res.status(401).json({ message: "Invalid signature" })
    return
  }

  const BodySchema = z
    .object({
      event_id: z.string().min(1),
      status: z.string().min(1),
      external_id: z.string().optional(),
      message: z.string().optional(),
      consultation_id: z.string().optional(),
    })
    .passthrough()

  const parsed = BodySchema.safeParse(bodyUnknown)
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" })
    return
  }

  const body = parsed.data
  const eventId = body.event_id.trim()
  const status = body.status.trim()
  if (!eventId || !status) {
    res.status(400).json({ message: "event_id and status are required" })
    return
  }

  const businessService = req.scope.resolve(BUSINESS_MODULE) as any
  const complianceService = req.scope.resolve(COMPLIANCE_MODULE) as any

  const events = (await businessService
    .listOutboxEvents({ id: eventId }, { take: 1 })
    .catch(() => [])) as any[]

  const event = events[0] ?? null
  if (!event) {
    res.status(404).json({ message: "Outbox event not found" })
    return
  }

  const at = new Date().toISOString()
  const existingMeta = (event.metadata ?? {}) as Record<string, unknown>
  const history = Array.isArray(existingMeta.partner_updates) ? existingMeta.partner_updates : []

  const updateEntry = {
    at,
    status,
    external_id: asString(body.external_id),
    message: asString(body.message),
    raw: body,
  }

  const nextMeta = {
    ...existingMeta,
    partner_status: status,
    partner_external_id: updateEntry.external_id ?? existingMeta.partner_external_id ?? null,
    partner_message: updateEntry.message ?? existingMeta.partner_message ?? null,
    partner_updates: [...history, updateEntry],
  }

  await businessService.updateOutboxEvents({
    id: eventId,
    metadata: nextMeta,
  })

  const consultationId =
    asString(body.consultation_id) ||
    asString(event.payload?.consultation_id) ||
    null

  await complianceService
    ?.logAuditEvent?.({
      actor_type: "system",
      actor_id: "partner-status-webhook",
      actor_email: null,
      action: "update",
      entity_type: "consultation",
      entity_id: consultationId || eventId,
      business_id: event.business_id,
      consultation_id: consultationId,
      order_id: null,
      changes: { before: null, after: { partner_status: status, outbox_event_id: eventId } },
      metadata: { webhook: "partner/status" },
      risk_level: "low",
      flagged: false,
    })
    .catch(() => null)

  res.status(200).json({ ok: true })
}
