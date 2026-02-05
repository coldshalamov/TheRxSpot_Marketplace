# Week 1 Reliability Audit (“Chaos Monkey”) — TheRxSpot Marketplace

Date: **February 5, 2026**

## Executive summary

The highest-risk failure mode in this repo was **consult intake**: the store endpoint performed multiple DB writes (consult submission → patient → consultation → approval) without a transaction, which means a crash or concurrency spike could create **orphans and duplicates**.

This week’s hardening work makes consult intake **crash-tolerant and retriable** by:

- Treating `consult_submission` as the **durable source of truth** (persist first, reconcile later).
- Adding **DB-level uniqueness guards** to prevent duplicates under concurrency.
- Reintroducing `process-consult-submission` as a **reconciliation job** that can safely be retried.
- Making the cart “consultation fee” endpoint **idempotent** via a deterministic line-item id.
- Replacing several request-boundary `any` payloads with **Zod validation**.
- Removing all `TODO` / `FIXME` markers from the codebase.

## Fragile code paths found (and what was changed)

### 1) Consult intake: crash mid-request left orphaned records
**Observed:** `POST /store/businesses/:slug/consult` created `consult_submission`, then created `patient`, `consultation`, and `consult_approval` sequentially. If the server crashed mid-way, the system could end up in an inconsistent state.

**Fixes:**
- Persist more intake fields on `consult_submission` so a job can reconstruct the missing objects after a crash.
- Add uniqueness constraints to prevent duplicates under concurrency.
- Add an idempotent reconciliation job: `src/jobs/process-consult-submission.ts`.

### 2) Consult intake: 50 concurrent submits created duplicates
**Observed:** without uniqueness constraints + dedupe logic, concurrent submissions can create multiple pending approvals and/or multiple consultations.

**Fixes:**
- Add DB uniqueness guards:
  - one pending `consult_submission` per `(business_id, customer_id, product_id)`
  - one pending `consult_approval` per `(business_id, customer_id, product_id)`
  - one `consult_approval` per `consultation_id`
  - one `consultation` per `originating_submission_id`
  - one `patient` per `(business_id, customer_id)`
- Add request-level idempotency support via `Idempotency-Key` (optional).

### 3) Cart consultation-fee endpoint: check-then-add race
**Observed:** `/store/carts/:id/consultation-fee` checked if a fee item exists, then added one. Two concurrent calls could both pass the check and both add line items.

**Fix:**
- Use a deterministic `line_item.id` derived from `(cartId, consultationId)` so the second concurrent call hits a uniqueness violation and becomes idempotent.

### 4) Multiple consult intake sources of truth
**Observed:** `/store/consultations` included a POST endpoint that could create consultations directly, bypassing the consult submission + approval workflow.

**Fix:**
- `POST /store/consultations` now returns `410 ENDPOINT_DEPRECATED` and points callers to `POST /store/businesses/:slug/consult`.

### 5) Nondeterministic “simulation failures” in a background job
**Observed:** `process-payouts` randomly failed ~5% of the time, which is a production footgun.

**Fix:**
- Gate simulated provider failures behind `PAYOUT_SIM_FAILURE_RATE` (default `0`).

## Key implementation changes

### Schema hardening
- `src/modules/business/migrations/Migration20260205073000.ts`
  - Adds: `consult_submission.customer_id`, `idempotency_key`, `chief_complaint`, `medical_history`
  - Adds: uniqueness constraints for pending submissions and approvals
- `src/modules/consultation/migrations/Migration20260205073010.ts`
  - Adds: unique `patient(business_id, customer_id)` (when `customer_id` is present)
  - Adds: unique `consultation(originating_submission_id)` (when present)

### Crash-safe reconciliation job (idempotent + retriable)
- `src/jobs/process-consult-submission.ts`
  - Scans pending `consult_submission` rows and ensures downstream `patient`, `consultation`, and pending `consult_approval` exist.
  - Uses DB uniqueness + “create or retrieve” logic to avoid duplications.

### Concurrency / idempotency changes
- `src/api/store/businesses/[slug]/consult/route.ts`
  - Zod-validates payload
  - Stores `customer_id` + persisted intake fields on `consult_submission`
  - Handles unique violations as an idempotent retry path
- `src/api/store/carts/[id]/consultation-fee/route.ts`
  - Zod-validates payload
  - Uses deterministic `line_item.id` for idempotent add

### Request-boundary validation (Zod)
Added/updated Zod parsing in several critical endpoints:
- Consult intake (`/store/businesses/:slug/consult`)
- Cart consult fee (`/store/carts/:id/consultation-fee`)
- Admin consult status transitions (`/admin/consultations/:id/status`)
- Hub provisioning (`/admin/hub/provision`) while preserving canonical signature validation
- Partner webhook callback (`/webhooks/partner/status`) while preserving canonical signature validation

## Tests added (must-pass)

### Concurrency stress test
- `src/tests/integration/consult-intake-concurrency.test.ts`
  - Fires **50 concurrent** consult submissions and asserts there is exactly **1** pending:
    - `consult_submission`
    - `consult_approval`
    - `consultation`
    - `patient`

### Job idempotency test
- `src/tests/integration/process-consult-submission-job.test.ts`
  - Creates an “orphaned” `consult_submission`
  - Runs `process-consult-submission` twice
  - Asserts no duplicates are created

### How to run
- Backend integration suite: `npm run test:integration:custom`
- Backend build: `npm run build`
- Storefront build: `npm -C TheRxSpot_Marketplace-storefront run build`

## “Kill the zombies” status (TODO/FIXME/any)

- `TODO` / `FIXME`: **0 occurrences** in `src/` and storefront after cleanup.
- `any`: Reduced in the most important request boundaries by replacing `req.body as any` / `Record<string, any>` with Zod parsing.

**Remaining work:** there are still many internal `any` uses in module services, workflows, and some admin/document endpoints. Treat these as a follow-up hardening pass:

1) Prioritize `src/api/store/**` and `src/api/webhooks/**` first (external inputs).
2) Replace remaining `Record<string, any>` payload parsing with Zod schemas.
3) Only then address service-layer `any` (often needed because of Medusa framework typing gaps).

## Purge candidates (repo cleanup)

This repo started from template/code imports; these are the most common safe purge targets:

- **Build artifacts**: ensure `.medusa/`, `node_modules/`, and `uploads/` are gitignored (keep locally, never commit).
- **One-off tooling**: old MCP server scaffolding was already removed (`packages/mcp-server`).
- **Legacy/dead endpoints**: keep deprecated routes returning 410/404, or delete them once storefront is confirmed not to call them.
- **Template leftovers**: audit `integration-tests/`, `seed-data/`, and `launcher_assets/` — keep only what you actively use for onboarding/dev.

If you want, I can produce a “safe delete list” by:
1) mapping references (`rg`) + import graph,
2) checking CI/test usage,
3) proposing deletions with a rollback plan.

