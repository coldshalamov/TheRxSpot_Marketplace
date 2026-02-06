# TheRxSpot 90-Day Recovery & Scale Program Tracker
> Start Date: 2026-02-05 | Target: ~2026-05-06

## Phase 0: Stabilization & Program Setup (Week 1)
- [x] Codebase exploration and baseline assessment
- [x] Route contract inventory and parity checklist
- [x] Template schema contract defined
- [x] Provider adapter contract defined
- [x] Stripe Connect contract defined
- [x] CI/CD gap analysis
- [x] Release criteria and test matrix locked
- [x] Add `tsc --noEmit` to CI pipeline
- [ ] Add ESLint configuration + CI lint step
- [x] Update ci-cd.yml with missing gates (post-deploy health/ready/auth-guard checks)
- [ ] Verify smoke script works and integrate into CI
- [ ] Create workstream branches

## Phase 1: Security + Template Foundation + Admin Parity (Weeks 2-4)

### Workstream A: Compliance (Epics A2, A3)
- [x] Extend audit middleware to cover /admin/custom/* and /admin/businesses/*
- [x] Extend audit middleware to cover /admin/coupons*
- [x] Add extractEntityInfo patterns for custom admin routes
- [x] Add audit path coverage in auditLoggingMiddleware
- [x] Add cross-tenant access denial tests (8 entity types covered)
- [ ] Audit document-upload middleware for fail-closed virus scanning
- [ ] Verify signed URL expiry for document downloads
- [ ] Add CORS validation hardening

### Workstream B: Template Foundation (Epics B1, B2)
- [x] Create TemplateConfig entity/model in business module
- [x] Create template_config migration (Migration20260205080000)
- [x] Register TemplateConfig in BusinessModuleService
- [x] Add template helper methods (getPublishedTemplate, createDefaultTemplate, publishTemplate)
- [x] Add GET/PUT /admin/businesses/:id/theme endpoints
- [x] Expand GET /store/tenant-config with template payload
- [x] Add default template auto-creation in provision workflow (createDefaultTemplateStep)
- [ ] Implement storefront template registry skeleton
- [ ] Implement template schema validation (JSON schema for sections)

### Workstream C: Admin Parity Core (Epic C1 first tranche)
- [x] Create Coupon entity/model in business module
- [x] Create coupon migration (Migration20260205081000)
- [x] Register Coupon in BusinessModuleService
- [x] Add coupon helper methods (listCouponsByBusiness, getCouponByCode, validateCoupon, incrementCouponUsage)
- [x] Implement coupon management CRUD endpoints (GET/POST /admin/coupons, GET/PUT/DELETE /admin/coupons/:id)
- [x] Implement store coupon validation endpoint (POST /store/coupons/validate)
- [x] Add consultation -> order generation pipeline (POST /admin/consultations/:id/generate-order)
- [ ] Add location serviceable states management
- [ ] Add domain verification admin UX endpoints
- [ ] Verify admin navigation/route integrity

### Deliverable: First platform demo (tenant-specific template selection + safe rendering)

## Phase 2: Stripe Connect + Provider Automation + Editor UX (Weeks 5-7)

### Workstream C: Payments & Providers (Epics C2, C3)
- [ ] Install stripe package
- [ ] Implement Stripe Connect onboarding flow
- [ ] Implement PaymentIntent creation with split logic
- [ ] Implement webhook handlers (idempotent, replay-safe)
- [ ] Implement payout lifecycle
- [ ] Implement provider adapter interface
- [ ] Implement outbound event dispatch with retries
- [ ] Implement inbound webhook ingestion with dedup
- [ ] Add ledger consistency checks

### Workstream B: Editor UX (Epics B2, B3)
- [ ] Implement interactive template editor admin UI
- [ ] Add section reorder/toggle functionality
- [ ] Add block content editing
- [ ] Implement publish workflow with versioned snapshots
- [ ] Add preview token generation

### Workstream D: Analytics Foundation (Epic D1)
- [ ] Design analytics data model
- [ ] Implement revenue/conversion metrics collection
- [ ] Build initial admin analytics dashboard

## Phase 3: Hardening + Full Flow Validation (Weeks 8-10)

### Workstream A: Compliance Evidence (Epics A1, A4)
- [ ] Build control matrix mapped to code
- [ ] Add evidence collection automation
- [ ] Tighten CORS for production
- [ ] Harden rate-limiting fallback behavior
- [ ] Add alerting for auth abuse and audit failures

### Workstream C: Resilience (Epics C1 tail, C4)
- [ ] Complete remaining admin parity items
- [ ] Add order state machine finite-state validation
- [ ] Add subscriber/job idempotency protections
- [ ] Add backfill/reconcile tools

### Workstream D: Observability + CI (Epics D2, D3)
- [ ] Add correlation IDs everywhere
- [ ] Trace critical flows end-to-end
- [ ] Add alerting infrastructure
- [ ] Complete all CI quality gates
- [ ] Add environment smoke gates post-deploy
- [ ] Full UAT against realistic tenant scenarios

## Phase 4: Launch Readiness (Weeks 11-13)
- [ ] Security/compliance review pack
- [ ] Load/failure testing
- [ ] Rollback drills
- [ ] Production launch checklist
- [ ] Controlled rollout
- [ ] Hypercare plan with incident SOPs
