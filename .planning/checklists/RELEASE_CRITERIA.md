# Release Criteria & Test Matrix
> Phase 0 - locked criteria for go-live readiness

## Release Blocker Policy
A release to production is BLOCKED if any of these fail:
1. Backend TypeScript compilation (`tsc --noEmit`)
2. Backend unit tests
3. Backend integration tests (all 3 suites)
4. Trivy security scan (CRITICAL/HIGH)
5. Backend build
6. Storefront build
7. Post-deploy health check
8. Post-deploy ready check

## Test Matrix

### Integration Test Suite (23 tests)
| Test File | Domain | Status | Priority |
|-----------|--------|--------|----------|
| tenant-resolution.test.ts | Multi-tenant | Exists | P0 |
| consult-gating.test.ts | Commerce/HIPAA | Exists | P0 |
| consultation-lifecycle.test.ts | Consultations | Exists | P0 |
| consultation-apis.test.ts | Consultations | Exists | P0 |
| consultations-management.test.ts | Consultations | Exists | P0 |
| consult-intake-concurrency.test.ts | Consultations | Exists | P0 |
| process-consult-submission-job.test.ts | Jobs | Exists | P0 |
| order-workflow.test.ts | Orders | Exists | P0 |
| order-state-guards.test.ts | Orders | Exists | P0 |
| orders-global-admin.test.ts | Orders/Admin | Exists | P0 |
| documents.test.ts | Compliance | Exists | P0 |
| document-admin-apis.test.ts | Compliance | Exists | P0 |
| audit-logging.test.ts | Compliance/HIPAA | Exists | P0 |
| mvp-audit.test.ts | Compliance | Exists | P0 |
| mvp-phi-encryption.test.ts | Compliance/HIPAA | Exists | P0 |
| earnings.test.ts | Financials | Exists | P0 |
| earnings-management-admin.test.ts | Financials | Exists | P0 |
| financial-apis.test.ts | Financials | Exists | P0 |
| rate-limiting.test.ts | Security | Exists | P1 |
| soft-delete-restore.test.ts | Data integrity | Exists | P1 |
| dashboard-home.test.ts | Admin UI | Exists | P1 |
| users-management.test.ts | Users | Exists | P1 |
| hub-provisioning-contract.test.ts | Provisioning | Exists | P0 |

### Tests To Add (by workstream)

#### Workstream A: Compliance
- [ ] Cross-tenant access denial proof (all tenant-scoped endpoints)
- [ ] Audit event completeness (every PHI route emits event)
- [ ] Upload virus scan fail-closed behavior
- [ ] Signed URL expiry verification
- [ ] CORS origin validation

#### Workstream B: Templates
- [ ] Template selection + rendering for tenant
- [ ] Invalid template fallback to default
- [ ] Section order/visibility changes reflected
- [ ] Domain-specific template overrides
- [ ] Preview token generation + resolution

#### Workstream C: Commerce
- [ ] Coupon CRUD operations
- [ ] Stripe Connect onboarding flow
- [ ] Payment intent creation + split logic
- [ ] Webhook idempotency (replay same event)
- [ ] Payout lifecycle (request -> status -> completion)
- [ ] Refund flow with ledger consistency
- [ ] Consultation approval -> order generation
- [ ] Provider adapter dispatch + retry
- [ ] Provider webhook ingestion + dedup
- [ ] Order state machine validation (all transitions)

#### Workstream D: Analytics/Observability
- [ ] Metrics endpoint returns expected shape
- [ ] Correlation ID propagation through request lifecycle
- [ ] Structured log format validation

### Smoke Test Matrix (Post-Deploy)
| Check | Endpoint | Expected | Environment |
|-------|----------|----------|-------------|
| Health | GET /health | 200 | All |
| Ready | GET /ready | 200 | All |
| Admin shell | GET /app | 200 + HTML | Staging, Prod |
| Storefront shell | GET / (storefront) | 200 + HTML | Staging, Prod |
| Auth CORS | OPTIONS /auth/* | CORS headers | All |
| Protected route | GET /admin/businesses | 401 (no auth) | All |
| Store tenant config | GET /store/tenant-config | 200 + JSON | Staging, Prod |

### Performance/Reliability SLOs (Phase 3+)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Admin list endpoints p95 | < 500ms | Load test |
| Store product listing p95 | < 300ms | Load test |
| Webhook processing p95 | < 2s | Monitoring |
| Error rate (5xx) | < 0.1% | Monitoring |
| Uptime | 99.9% | Monitoring |

## Go-Live Checklist
- [ ] All P0 tests passing
- [ ] All new workstream tests passing
- [ ] Post-deploy smoke suite green
- [ ] Stripe Connect verified in test mode
- [ ] At least one tenant fully provisioned end-to-end
- [ ] Security/compliance review pack complete
- [ ] Rollback procedure documented and tested
- [ ] Hypercare plan with incident SOPs defined
