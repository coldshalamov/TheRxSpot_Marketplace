# TheRxSpot Marketplace - Baseline Assessment
> Generated: 2026-02-05 | Phase 0 - Stabilization & Program Setup

## Platform Stack
- **Backend**: Medusa v2.13.1 (MedusaJS headless commerce)
- **Language**: TypeScript 5.6
- **Runtime**: Node.js 20+
- **Database**: PostgreSQL (via Medusa)
- **Cache**: Redis (ioredis)
- **Storefront**: Next.js (App Router) - separate directory `TheRxSpot_Marketplace-storefront/`
- **Admin UI**: Medusa Admin SDK 2.13.1 with custom admin routes
- **Testing**: Jest 29.7 + @medusajs/test-utils + custom integration harness
- **CI/CD**: GitHub Actions (single `ci-cd.yml`)
- **Container**: Docker + docker-compose

## Module Architecture (4 Custom Modules)

| Module | Models | Service | Migrations |
|--------|--------|---------|------------|
| **business** | Business, Location, BusinessDomain, BusinessUser, ConsultApproval, ConsultSubmission, LocationProduct, OrderStatusEvent, OutboxEvent, ProductCategory | businessModuleService | 7 migrations |
| **consultation** | Consultation, Clinician, Patient, ClinicianSchedule, ClinicianAvailabilityException, ConsultationStatusEvent | consultationModuleService | 6 migrations |
| **financials** | EarningEntry, Payout | financialsModuleService | 5 migrations |
| **compliance** | Document, AuditLog | complianceModuleService | 2 migrations + storage providers (local, S3) |

## API Route Inventory

### Admin Routes (~90 route files)
- **Businesses**: CRUD, status, provision, restore, domains, locations, QR codes
- **Consultations**: CRUD, status, assign, complete, restore, documents
- **Clinicians**: CRUD, availability, schedule, restore
- **Patients**: CRUD, restore
- **Documents**: CRUD, search, verify, download, restore
- **Earnings**: CRUD, summary, export, restore
- **Payouts**: CRUD, export
- **Orders**: status management
- **Categories**: CRUD, reorder
- **Locations**: products, product reorder
- **Audit Logs**: list, summary, detail, flag
- **Dashboard**: home
- **Hub**: provision
- **Tenant-scoped** (prefixed /admin/tenant/): me, branding, clinicians, consultations, documents, earnings, payouts, orders, users, audit-logs
- **Custom** (prefixed /admin/custom/): users (CRUD, export, status, bulk), consultations (CRUD, export, notes), orders (CRUD, export, fulfillment, refund, packing-slips, items)

### Store Routes (~18 route files)
- businesses (list, detail by slug, locations, consult submission)
- carts (create, consultation-fee)
- consultations (list, detail, cancel, available-slots, approvals)
- documents (CRUD, download)
- product-categories (list, detail)
- tenant-config
- custom (health/misc)

### Infrastructure Routes
- `/health` - health check
- `/ready` - readiness check
- `/webhooks/partner/status` - partner status webhook

## Middleware Stack (8 middleware files)
1. **request-context** - Correlation IDs (request_id, tenant_id, user_id) for structured logging
2. **tenant-resolution** - Multi-tenant resolution for `/store/*`
3. **auto-logoff** - HIPAA-001: 15-minute inactivity timeout
4. **consult-gating** - Cart modification protection (all cart endpoints)
5. **rate-limiter** - 4 limiters: auth, registration, password-reset, consult-submission
6. **audit-logging** - PHI access tracking (2 exports: general + document-specific)
7. **tenant-admin-auth** - Authentication for `/admin/tenant/*`
8. **tenant-isolation** - Cross-tenant access verification + security event logging
9. **document-upload** - Upload handling

## Subscribers (7)
- order-created, order-delivered, order-status-changed, order-placed
- consult-submission-created, business-status-changed, consultation-completed

## Background Jobs (4)
- process-payouts, dispatch-outbox-events, process-consult-submission, domain-verification

## Workflows (3)
- provision-business, order-lifecycle, consult-gating

## Medusa Module Links (4)
- business-cart, business-order, business-product, business-sales-channel

## Test Coverage (23 integration tests)
- consult-gating, earnings, documents, audit-logging, rate-limiting
- consultation-lifecycle, document-admin-apis, financial-apis
- soft-delete-restore, dashboard-home, users-management
- earnings-management-admin, orders-global-admin, order-workflow
- consultation-apis, tenant-resolution, consultations-management
- mvp-audit, mvp-phi-encryption, process-consult-submission-job
- consult-intake-concurrency, hub-provisioning-contract, order-state-guards

## Utilities
- encryption.ts, env-validator.ts, stable-json.ts, hmac.ts, email.ts
- order-consult-guard.ts, workflow.ts, logger.ts (Pino structured JSON)

## Documentation (docs/)
- API.md, API_REFERENCE.md, ARCHITECTURE.md, DEPLOYMENT.md, FEATURES.md
- FULFILLMENT_DISPATCH.md, HUB_PROVISIONING.md, IMPLEMENTATION_PLAN.md
- MIGRATIONS.md, PURGE_CANDIDATES.md, RELIABILITY_AUDIT_WEEK1.md
- SYSTEM_INTEGRATION_PLAN.md, TESTING_SUMMARY.md
- archive/ directory with prior agent execution summaries

---

## Critical Gaps (Code Truth vs Plan Assumptions)

### GAP-1: No Stripe SDK (CRITICAL - Workstream C)
**Finding**: `stripe` is NOT in package.json dependencies. No Stripe Connect integration exists.
**Impact**: Epic C2 (Stripe Connect) requires full greenfield implementation.
**Action**: Add `stripe` package, implement Connect onboarding, payment intents, transfer splits, payout lifecycle, webhook handlers.

### GAP-2: No Coupon Management (Workstream C)
**Finding**: No coupon-related admin routes found. Zero coupon CRUD endpoints.
**Impact**: Epic C1 parity gap.
**Action**: Implement coupon CRUD endpoints in admin API.

### GAP-3: Template System is Branding-Variable Only (Workstream B)
**Finding**: `/admin/tenant/branding` route exists but is simple key-value branding config. No template registry, no section/block model, no template versioning.
**Impact**: Entire Workstream B (Template Platform) is greenfield.
**Action**: Design template schema, implement registry, build editor UX.

### GAP-4: No Provider Network Adapter Layer (Workstream C)
**Finding**: Single webhook at `/webhooks/partner/status` exists but no adapter pattern, no outbound event dispatch to providers, no retry/dead-letter for provider communications.
**Impact**: Epic C3 (Provider Automation) requires new adapter architecture.
**Action**: Design adapter interface, implement outbound events, build webhook ingestion with idempotency.

### GAP-5: Consultation -> Order Generation Missing
**Finding**: Consultation completion subscriber exists but no evidence of automatic order generation from approved consultations.
**Impact**: Core consult-gated commerce flow incomplete.
**Action**: Implement consultation approval -> order creation pipeline.

### GAP-6: CI/CD Quality Gates Incomplete
**Finding**: Single `ci-cd.yml` file. No evidence of: frontend typecheck/lint gates, e2e smoke gates, environment smoke verification, release blocker policies.
**Impact**: Epic D3 requires significant CI hardening.
**Action**: Audit ci-cd.yml, add missing gates.

### GAP-7: Audit Logging Coverage Gaps
**Finding**: Audit middleware covers main admin paths but `/admin/custom/*` and `/admin/tenant/*` paths may not all produce immutable audit events. No audit middleware on `/admin/businesses/*`.
**Impact**: Epic A2 (Audit Hardening).
**Action**: Extend audit middleware to cover all admin paths with PHI exposure.

### GAP-8: Refund Completion Missing
**Finding**: Refund route exists at `/admin/custom/orders/[id]/refund` but without Stripe integration, actual money movement is impossible.
**Impact**: Depends on GAP-1 resolution.

### GAP-9: Virus Scanning Integration Unclear
**Finding**: `clamscan` is in dependencies. Document upload middleware exists. Need to verify fail-closed behavior.
**Impact**: Epic A3 (Upload Security).
**Action**: Audit document-upload middleware for fail-closed enforcement.

### GAP-10: Domain Verification UX Incomplete
**Finding**: `domain-verification` job exists but no admin UX flow for domain verification status/actions found in admin routes.
**Impact**: Epic C1 parity.

## Existing Strengths
1. Solid module architecture with 4 well-separated business domains
2. Comprehensive middleware stack covering HIPAA requirements
3. 23 integration tests covering critical paths
4. Structured JSON logging via Pino
5. Tenant isolation with security event logging
6. PHI encryption utilities exist
7. Rate limiting on sensitive endpoints
8. Auto-logoff for HIPAA compliance
9. Outbox pattern for event dispatch (dispatch-outbox-events job)
10. Consult gating on all cart endpoints
