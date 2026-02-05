# Fulfillment Dispatch (Outbox)

This repo uses a durable **Outbox** pattern to guarantee “no lost dispatches” when an approved consultation must be pushed to a fulfillment partner.

## When dispatch happens

- Primary trigger: clinician/ops marks a consultation as **approved** via `POST /admin/consultations/:id/status`.
- Durable write: the approval handler creates an `outbox_event` row with a stable `dedupe_key`.
- Background delivery: the scheduled job `dispatch-outbox-events` retries delivery until success or dead-letter.

## Partner delivery (webhook)

The dispatcher posts JSON to the configured partner URL:

- Per-business override: `business.settings.fulfillment_webhook_url`
- Fallback: `DEFAULT_FULFILLMENT_WEBHOOK_URL`

### Headers

- `Content-Type: application/json`
- `X-RxSpot-Event-Id: <outbox_event.id>`
- `X-RxSpot-Timestamp: <epoch_ms>`
- Optional signature:
  - `X-RxSpot-Signature: sha256=<hex>`
  - Signature input: `<timestampMs>.<eventId>.<rawBody>`
  - Secret: `business.settings.fulfillment_webhook_secret` or `OUTBOX_SIGNING_SECRET`

### Body shape

```json
{
  "event_id": "outbox_...",
  "type": "consult.approved",
  "business_id": "bus_...",
  "payload": {
    "consult_approval_id": "ca_...",
    "consultation_id": "consult_...",
    "customer_id": "cust_...",
    "product_id": "prod_...",
    "approved_at": "2026-02-05T00:00:00.000Z",
    "expires_at": "2026-05-06T00:00:00.000Z"
  }
}
```

## Email fallback (dead-letter)

If webhook delivery fails for 5 attempts, the event is marked `dead_letter` and a best-effort email is sent:

- Per-business: `business.settings.fulfillment_email` or `business.settings.ops_email`
- Fallback: `DEFAULT_FULFILLMENT_EMAIL`

Email delivery uses SendGrid if `SENDGRID_API_KEY` + `FROM_EMAIL` are configured.

## Partner status callbacks (optional)

Partners can post delivery/status updates back to RxSpot:

- Endpoint: `POST /webhooks/partner/status`
- Auth headers:
  - `X-RxSpot-Timestamp: <epoch_ms>`
  - `X-RxSpot-Signature: sha256=<hex>`
- Signature input: `<timestampMs>.<stableStringify(body)>`
- Secret: `PARTNER_STATUS_WEBHOOK_SECRET` (or `OUTBOX_SIGNING_SECRET` fallback)

Body requirements:

- `event_id` (outbox event id)
- `status` (partner-defined string)

The callback is stored in `outbox_event.metadata.partner_updates[]` and audit-logged.

