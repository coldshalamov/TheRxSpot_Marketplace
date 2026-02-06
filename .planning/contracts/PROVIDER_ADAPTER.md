# Provider Network Adapter Contract (Workstream C - Epic C3)
> Phase 0 specification - for review before implementation

## Current State
- Single webhook: `/webhooks/partner/status` exists
- No adapter pattern, no outbound events, no retry/dead-letter
- OutboxEvent model exists in business module (dispatch-outbox-events job)

## Target Architecture

### Adapter Interface
```typescript
interface ProviderAdapter {
  readonly provider_key: string  // e.g., "curexa", "truepill", "manual"

  // Outbound: Send events to provider
  dispatchOrder(order: OutboundOrderEvent): Promise<DispatchResult>
  dispatchConsultUpdate(consult: OutboundConsultEvent): Promise<DispatchResult>
  checkOrderStatus(external_id: string): Promise<ProviderOrderStatus>

  // Health
  healthCheck(): Promise<{ healthy: boolean; latency_ms: number }>
}

interface DispatchResult {
  success: boolean
  external_id: string | null
  idempotency_key: string
  retry_after?: number          // seconds, if rate-limited
  error?: string
}

interface OutboundOrderEvent {
  order_id: string
  business_id: string
  patient_id: string
  items: Array<{
    product_id: string
    quantity: number
    metadata: Record<string, any>
  }>
  shipping_address: Address
  consultation_id: string | null
  idempotency_key: string
}

interface OutboundConsultEvent {
  consultation_id: string
  business_id: string
  status: string
  outcome: string | null
  clinician_notes: string | null
  idempotency_key: string
}
```

### Inbound Webhook Contract
```
POST /webhooks/partner/status
Headers:
  X-Provider-Key: string        // identifies the provider
  X-Idempotency-Key: string     // dedup key
  X-Signature: string           // HMAC signature for verification
Body:
{
  "event_type": "order.status_updated" | "order.fulfilled" | "order.cancelled" | "order.error",
  "external_id": string,
  "order_id": string,           // our internal order ID
  "status": string,
  "metadata": Record<string, any>,
  "timestamp": string           // ISO 8601
}
```

### Dispatch Pipeline
```
Order Placed Subscriber
  -> Create OutboxEvent (existing pattern)
  -> dispatch-outbox-events job picks up
  -> Resolve ProviderAdapter for business
  -> adapter.dispatchOrder(event)
  -> On success: mark OutboxEvent as dispatched
  -> On failure: increment retry_count, set next_retry_at
  -> On max retries: move to dead-letter, alert
```

### Retry Policy
- Max retries: 5
- Backoff: exponential (30s, 2m, 8m, 30m, 2h)
- Dead-letter after max retries
- Manual retry available via admin endpoint

### Idempotency
- Outbound: idempotency_key = `${event_type}:${entity_id}:${timestamp_bucket}`
- Inbound: X-Idempotency-Key header, stored in processed_webhooks table
- Duplicate webhooks return 200 OK without re-processing

### Admin Endpoints
```
GET  /admin/businesses/:id/provider          -> Current provider config
PUT  /admin/businesses/:id/provider          -> Update provider config
GET  /admin/businesses/:id/provider/events   -> Outbox event history
POST /admin/businesses/:id/provider/events/:id/retry -> Manual retry
GET  /admin/provider/dead-letter             -> Dead-letter queue
POST /admin/provider/dead-letter/:id/retry   -> Retry dead-letter event
```

## Hybrid Manual Fallback
- If business has no provider adapter configured, orders route to admin manual queue
- Admin can manually process orders and update status
- Admin can switch between manual and automated modes per business
