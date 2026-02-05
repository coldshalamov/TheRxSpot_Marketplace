import { BUSINESS_MODULE } from "../modules/business"
import { createHmac } from "crypto"
import { sendEmail } from "../utils/email"
import { getLogger } from "../utils/logger"

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t ? t : null
}

function getNow(): Date {
  return new Date()
}

function computeBackoffMs(attempt: number): number {
  const base = 60_000 // 1 minute
  const max = 60 * 60_000 // 60 minutes
  const exp = Math.min(attempt, 10)
  return Math.min(base * Math.pow(2, exp - 1), max)
}

function signWebhook(secret: string, timestampMs: string, eventId: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestampMs}.${eventId}.${body}`)
    .digest("hex")
}

async function reconcileApprovedConsultApprovals(container: any) {
  const businessService = container.resolve(BUSINESS_MODULE) as any
  const logger = getLogger()

  // Best-effort reconciliation to guarantee "no lost dispatches" even if the approving
  // request fails before writing an outbox event.
  const approvals = await businessService.listConsultApprovals(
    { status: "approved" },
    { order: { approved_at: "DESC" }, take: 200 }
  )

  for (const approval of approvals) {
    const dedupeKey = `consult_approval:${approval.id}:approved`
    await businessService.createOutboxEventOnce({
      business_id: approval.business_id,
      type: "consult.approved",
      dedupe_key: dedupeKey,
      payload: {
        consult_approval_id: approval.id,
        consultation_id: approval.consultation_id ?? null,
        customer_id: approval.customer_id,
        product_id: approval.product_id,
        approved_at: approval.approved_at ?? null,
        expires_at: approval.expires_at ?? null,
      },
      metadata: { source: "reconcileApprovedConsultApprovals" },
    }).catch((e: any) => {
      logger.warn(
        {
          tenant_id: approval.business_id,
          consult_approval_id: approval.id,
          error: e?.message ?? String(e),
        },
        "dispatch-outbox: reconcile failed"
      )
    })
  }
}

async function deliverEvent(container: any, event: any) {
  const businessService = container.resolve(BUSINESS_MODULE) as any
  const logger = getLogger()
  const complianceService = container.resolve("complianceModuleService") as any

  const now = getNow()
  const nextAttemptAt = event.next_attempt_at ? new Date(event.next_attempt_at) : null
  if (nextAttemptAt && nextAttemptAt.getTime() > now.getTime()) {
    return
  }

  const attempts = Number(event.attempts || 0) + 1

  let business: any = null
  try {
    business = await businessService.retrieveBusiness(event.business_id)
  } catch {
    // If business can't be retrieved, dead-letter.
    await businessService.updateOutboxEvents({
      id: event.id,
      status: "dead_letter",
      attempts,
      next_attempt_at: null,
      last_error: "Business not found",
    })
    return
  }

  const settings = (business.settings ?? {}) as Record<string, any>
  const webhookUrl =
    asString(settings.fulfillment_webhook_url) ||
    asString(process.env.DEFAULT_FULFILLMENT_WEBHOOK_URL)

  const partnerEmail =
    asString(settings.fulfillment_email) ||
    asString(settings.ops_email) ||
    asString(process.env.DEFAULT_FULFILLMENT_EMAIL)

  const bodyObj = {
    event_id: event.id,
    type: event.type,
    business_id: event.business_id,
    payload: event.payload ?? {},
  }
  const body = JSON.stringify(bodyObj)

  const timestampMs = String(Date.now())
  const signingSecret =
    asString(settings.fulfillment_webhook_secret) ||
    asString(process.env.OUTBOX_SIGNING_SECRET)

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-rxspot-event-id": event.id,
    "x-rxspot-timestamp": timestampMs,
  }
  if (signingSecret) {
    headers["x-rxspot-signature"] = `sha256=${signWebhook(signingSecret, timestampMs, event.id, body)}`
  }

  try {
    if (!webhookUrl) {
      throw new Error("Missing fulfillment_webhook_url for business")
    }

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body,
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => "")
      throw new Error(`Webhook failed (${resp.status}): ${text.slice(0, 500)}`)
    }

    await businessService.updateOutboxEvents({
      id: event.id,
      status: "delivered",
      delivered_at: now,
      attempts,
      next_attempt_at: null,
      last_error: null,
      metadata: {
        ...(event.metadata ?? {}),
        delivered_via: "webhook",
        delivered_at: now.toISOString(),
      },
    })

    const consultationId = event.payload?.consultation_id ?? null

    await complianceService?.logAuditEvent?.({
      actor_type: "system",
      actor_id: "dispatch-outbox-events",
      actor_email: null,
      action: "create",
      entity_type: "consultation",
      entity_id: consultationId || event.id,
      business_id: event.business_id,
      consultation_id: consultationId,
      order_id: null,
      changes: { before: null, after: { status: "delivered", type: event.type, outbox_event_id: event.id } },
      metadata: { outbox: true },
      risk_level: "low",
    }).catch(() => null)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn(
      {
        tenant_id: event.business_id,
        outbox_event_id: event.id,
        error: msg,
      },
      "dispatch-outbox: event delivery failed"
    )

    const isDead = attempts >= 5
    const nextMs = isDead ? null : computeBackoffMs(attempts)

    await businessService.updateOutboxEvents({
      id: event.id,
      status: isDead ? "dead_letter" : "pending",
      attempts,
      next_attempt_at: nextMs ? new Date(Date.now() + nextMs) : null,
      last_error: msg,
      metadata: {
        ...(event.metadata ?? {}),
        last_failed_at: now.toISOString(),
      },
    })

    if (isDead && partnerEmail) {
      const alreadySent = !!(event.metadata as any)?.email_fallback_sent_at
      if (!alreadySent) {
        const subject = `[TheRxSpot] Dispatch failed (dead-letter): ${event.type}`
        const text = [
          `Dispatch permanently failed after ${attempts} attempts.`,
          ``,
          `Business: ${business.name} (${business.id})`,
          `Event: ${event.id}`,
          `Type: ${event.type}`,
          `Error: ${msg}`,
          ``,
          `Payload:`,
          body,
        ].join("\n")

        const emailRes = await sendEmail({ to: partnerEmail, subject, text })
        await businessService.updateOutboxEvents({
          id: event.id,
          metadata: {
            ...(event.metadata ?? {}),
            email_fallback_sent_at: now.toISOString(),
            email_fallback_sent: emailRes.sent,
            email_fallback_error: emailRes.error ?? null,
          },
        })
      }
    }
  }
}

export default async function dispatchOutboxEventsJob(container: any) {
  const businessService = container.resolve(BUSINESS_MODULE) as any
  const logger = getLogger()

  logger.info("dispatch-outbox: starting outbox dispatch job")

  await reconcileApprovedConsultApprovals(container).catch((e: any) => {
    logger.warn(
      { error: e?.message ?? String(e) },
      "dispatch-outbox: reconcile error"
    )
  })

  const pending = await businessService.listOutboxEvents(
    { status: "pending" },
    { order: { created_at: "ASC" }, take: 50 }
  )

  for (const event of pending) {
    await deliverEvent(container, event)
  }
}

export const config = {
  name: "dispatch-outbox-events",
  schedule: "*/2 * * * *", // Every 2 minutes
}
