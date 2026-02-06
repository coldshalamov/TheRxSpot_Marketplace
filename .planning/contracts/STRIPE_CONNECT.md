# Stripe Connect Contract (Workstream C - Epic C2)
> Phase 0 specification - for review before implementation

## Current State
- **No `stripe` package in dependencies**
- No payment intent creation, no Connect onboarding, no webhooks
- Refund route exists but cannot execute actual money movement
- Payout model exists in financials module but no Stripe payout integration

## Required Dependencies
```bash
npm install stripe
```

## Implementation Architecture

### 1. Stripe Connect Onboarding
```typescript
// POST /admin/businesses/:id/stripe/onboard
// Creates Stripe Connect account and returns onboarding URL
interface OnboardRequest {
  business_id: string
  return_url: string
  refresh_url: string
}

interface OnboardResponse {
  account_id: string
  onboarding_url: string
  status: "pending" | "onboarding" | "active" | "restricted"
}
```

Business model needs:
- `stripe_account_id: string | null`
- `stripe_onboarding_status: "none" | "pending" | "active" | "restricted"`

### 2. Payment Intent (Checkout)
```typescript
// Cart -> Payment Intent flow:
// 1. Customer reaches checkout
// 2. Frontend calls POST /store/carts/:id/payment-session
// 3. Backend creates Stripe PaymentIntent with:
//    - amount: cart total
//    - application_fee_amount: platform commission
//    - transfer_data.destination: business.stripe_account_id
//    - metadata: { order_id, business_id, cart_id }

interface PaymentIntentConfig {
  amount: number                    // in cents
  currency: string                  // "usd"
  application_fee_amount: number    // platform commission in cents
  transfer_data: {
    destination: string             // connected account ID
  }
  metadata: {
    order_id: string
    business_id: string
    cart_id: string
    customer_id: string
  }
}
```

### 3. Transfer Split Logic
```
Order Total: $100.00
  -> Platform Commission (15%): $15.00 (application_fee_amount)
  -> Business Payout: $85.00 (auto-transferred to connected account)

Commission rate stored per-business (default 15%, configurable).
```

### 4. Payout Lifecycle
```
PaymentIntent.succeeded
  -> EarningEntry created (amount, fee, net)
  -> Business balance updated

Payout Request (manual or scheduled):
  -> POST /admin/businesses/:id/payouts
  -> Creates Stripe Payout on connected account
  -> Payout model updated with stripe_payout_id

Payout Status Tracking:
  -> payout.paid webhook -> mark as completed
  -> payout.failed webhook -> mark as failed, alert
```

### 5. Webhook Handlers
```
POST /webhooks/stripe
Headers:
  Stripe-Signature: string

Events to handle:
  - payment_intent.succeeded    -> Complete order, create earning
  - payment_intent.payment_failed -> Mark order failed
  - account.updated            -> Update onboarding status
  - payout.paid                -> Mark payout completed
  - payout.failed              -> Mark payout failed, alert
  - charge.refunded            -> Process refund, update earning
  - charge.dispute.created     -> Alert, flag order

All handlers must be:
  - Idempotent (check event.id not already processed)
  - Replay-safe (re-processing same event has no side effects)
  - Ordered by event.created timestamp when relevant
```

### 6. Reconciliation
```
GET /admin/earnings/reconcile
  -> Compare local earning entries against Stripe balance transactions
  -> Flag discrepancies
  -> Generate reconciliation report

Automated daily job:
  - Fetch Stripe balance transactions for last 48 hours
  - Match against local earning entries
  - Alert on unmatched transactions
```

### 7. Admin Endpoints
```
GET    /admin/businesses/:id/stripe          -> Stripe account status
POST   /admin/businesses/:id/stripe/onboard  -> Start onboarding
GET    /admin/businesses/:id/stripe/balance  -> Connected account balance
POST   /admin/businesses/:id/payouts         -> Request payout
GET    /admin/earnings/reconcile             -> Reconciliation report
```

### 8. Ledger Consistency Checks
- Every PaymentIntent.succeeded must create exactly one EarningEntry
- EarningEntry.amount + EarningEntry.platform_fee = PaymentIntent.amount
- Payout.amount <= Business.available_balance
- No negative balances allowed
- Refund cannot exceed original charge amount

### 9. Security
- Webhook signature verification (Stripe-Signature header)
- Stripe API key stored in environment variables only
- Connected account IDs are sensitive - not exposed in store API
- Payout requests require admin authentication
