# TheRxSpot Marketplace - MASTER COORDINATION PLAN
## Multi-Agent Parallel Execution Strategy

---

## EXECUTIVE SUMMARY

**Objective:** Take TheRxSpot Marketplace from ~35% to 100% production-ready in 3-4 days through parallel development by two specialized agents.

**Agent Roles:**
- **Agent A (Claude):** Backend Core, Security, Data Layer, Business Logic
- **Agent B (GLM 4.7):** Frontend, Storefront, Tenant Portal, UI/UX

**Synchronization Points:**
- Daily checkpoint meetings (End of Day 1, 2, 3, 4)
- Shared communication via `.agent-a-requests/` and `.agent-b-requests/`
- Git commits with descriptive messages

---

## PARALLEL EXECUTION MAP

```
DAY 1                    DAY 2                    DAY 3                    DAY 4
─────────────────────────────────────────────────────────────────────────────────────────────

AGENT A (Backend)
├── A1.1 Server-Side     ├── A2.2 Consult API     ├── A3.2 Earnings        ├── A5.1 Integration
│   Consult Gating       │   Routes               │   System               │   Tests
├── A1.2 Migrations      ├── A2.3 Clinician       ├── A3.3 Financial       ├── A5.2 Documentation
├── A1.3 Security        │   Management           │   API Routes           └── FINAL REVIEW
│   Hardening            └── A3.1 Order Status    └── A4.1 Documents
├── A1.4 Jobs/Subscribers    Machine                  Upload
└── A2.1 Consult         └── SYNC POINT 2         └── A4.2 Audit Logs
    Models                                          └── SYNC POINT 3
    └── SYNC POINT 1

AGENT B (Frontend)
├── B1.1 Route           ├── B2.2 Patient         ├── B3.3 Consultations   ├── B5.3 Build
│   Consolidation        │   Consult Dashboard    │   Admin View             Checks
├── B1.2 Type Safety     ├── B2.3 Account         └── B4.1 Earnings        ├── B6.1 Frontend
├── B1.3 Error           │   Integration              Dashboard                Tests
│   Boundaries           └── B3.1 Order Detail    ├── B4.2 Earnings        └── B6.2 Cross-Browser
├── B1.4 Tenant SDK      │   Page (CRITICAL)          Detail                 └── FINAL REVIEW
│   Integration          ├── B3.2 Order List      └── B5.1 Navigation
├── B2.1 Consult Status  │   Improvements         └── SYNC POINT 3
│   Components           └── SYNC POINT 2
└── SYNC POINT 1

SYNCHRONIZATION POINTS
├── SP1: End of Day 1 - Security & Foundation Complete
├── SP2: End of Day 2 - Core Features Working
├── SP3: End of Day 3 - Integration Points Ready
└── SP4: End of Day 4 - Production Ready
```

---

## ZERO-CONFLICT ARCHITECTURE

### File Ownership Matrix

| Directory/File Pattern | Owner | Notes |
|------------------------|-------|-------|
| `src/modules/**` | Agent A | All backend models |
| `src/api/**` | Agent A | All API routes |
| `src/workflows/**` | Agent A | Business logic |
| `src/jobs/**` | Agent A | Background jobs |
| `src/subscribers/**` | Agent A | Event handlers |
| `src/links/**` | Agent A | Medusa links |
| `medusa-config.ts` | Agent A | Backend config |
| `.env` (root) | Agent A | Backend secrets |
| `docker-compose.yml` | Agent A | Infrastructure |
| `TheRxSpot_Marketplace-storefront/src/**` | Agent B | Storefront UI |
| `tenant-admin/src/**` | Agent B | Admin portal UI |
| `docs/**` | Both | Documentation |
| `README.md` | Both | Project docs |

### Shared Interfaces (Contract Files)

These files define the API contract between agents:

```typescript
// src/types/api-contract.ts (Agent A owns, Agent B reads)
// This file contains TypeScript interfaces for all API requests/responses

export interface ConsultationResponse {
  id: string
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  outcome: 'approved' | 'rejected' | 'pending' | null
  // ... all fields
}

export interface OrderResponse {
  id: string
  display_id: string
  status: string
  consultation: ConsultationResponse | null
  // ... all fields
}

export interface EarningsSummaryResponse {
  available: number
  pending: number
  lifetime: number
  ytd_payouts: number
}
```

**Rule:** Agent A creates/updates contract files. Agent B reads but doesn't modify.

---

## SYNCHRONIZATION PROTOCOL

### Sync Point 1: End of Day 1
**Goal:** Foundation solid, security in place

**Agent A Deliverables:**
- [ ] Server-side consult gating working (API bypass blocked)
- [ ] Strong secrets generated
- [ ] Database migrations created
- [ ] Consultation models defined

**Agent B Deliverables:**
- [ ] Route conflicts resolved
- [ ] TypeScript/ESLint strict mode enabled
- [ ] Error boundaries in place
- [ ] Consult status components created

**Coordination Tasks:**
1. Agent A verifies consult gating with API test
2. Agent B verifies routes work correctly
3. Both agents commit work
4. Create requests for Day 2 needs

---

### Sync Point 2: End of Day 2
**Goal:** Core features functional

**Agent A Deliverables:**
- [ ] Consultation API routes complete
- [ ] Order status machine working
- [ ] Clinician management functional

**Agent B Deliverables:**
- [ ] Patient consultation dashboard working
- [ ] Order detail page complete
- [ ] Order list improvements done

**Coordination Tasks:**
1. Agent B tests against Agent A's API
2. Verify frontend can create/view consultations
3. Fix any API contract mismatches
4. Plan Day 3 integration points

---

### Sync Point 3: End of Day 3
**Goal:** Integration complete, financials working

**Agent A Deliverables:**
- [ ] Earnings calculation working
- [ ] Document storage implemented
- [ ] Audit logging functional

**Agent B Deliverables:**
- [ ] Earnings dashboard displaying
- [ ] Tenant admin consultations view
- [ ] Navigation updated

**Coordination Tasks:**
1. Full integration test
2. Verify earnings display correctly
3. Test document upload flow
4. Prepare for final testing day

---

### Sync Point 4: End of Day 4
**Goal:** Production ready

**Agent A Deliverables:**
- [ ] All integration tests pass
- [ ] Security audit complete
- [ ] Documentation written

**Agent B Deliverables:**
- [ ] All E2E tests pass
- [ ] Build checks pass
- [ ] Cross-browser tested

**Final Tasks:**
1. Run complete test suite
2. Verify all critical paths
3. Final security check
4. Deploy to staging

---

## COMMUNICATION PROTOCOL

### Request Directory Structure

```
D:\GitHub\TheRxSpot_Marketplace\
├── .agent-a-requests\
│   └── (Agent B creates requests for Agent A here)
├── .agent-b-requests\
│   └── (Agent A creates requests for Agent B here)
└── .sync-points\
    ├── day-1-checkpoint.md
    ├── day-2-checkpoint.md
    ├── day-3-checkpoint.md
    └── day-4-final.md
```

### Request File Format

```markdown
# Request from [Agent X] to [Agent Y]
**Priority:** P0 (Critical) / P1 (Important) / P2 (Nice to have)
**Date:** 2026-02-03
**Deadline:** End of Day 2

## Summary
Brief description of what's needed

## Details
### What
Clear description of the requirement

### Why
Business/technical reason

### Suggested Implementation
```typescript
// Code example if applicable
```

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

### Example Request: Agent B → Agent A

```markdown
# Request: Add Earnings Summary Endpoint
**From:** Agent B (Frontend)
**To:** Agent A (Backend)
**Priority:** P0
**Date:** 2026-02-03

## Summary
Need an endpoint to fetch earnings summary for the tenant admin dashboard.

## Details
### Endpoint
`GET /admin/tenant/earnings/summary`

### Expected Response
```json
{
  "available": 1500.00,
  "pending": 750.00,
  "lifetime": 25000.00,
  "ytd_payouts": 18000.00
}
```

### Acceptance Criteria
- [ ] Returns correct amounts for authenticated tenant
- [ ] Available = sum of earnings with status='available'
- [ ] Pending = sum of earnings with status='pending'
- [ ] Lifetime = sum of all historical earnings
- [ ] YTD = sum of payouts this calendar year
```

---

## RISK MITIGATION

### Risk: API Contract Mismatch
**Mitigation:**
- Agent A creates contract types first
- Agent B implements against contract
- Daily sync to catch mismatches early
- Integration tests at each sync point

### Risk: File Conflicts
**Mitigation:**
- Clear ownership boundaries
- Shared types in `src/types/`
- No cross-boundary edits
- Communication via requests directory

### Risk: One Agent Blocked
**Mitigation:**
- Parallel work streams minimize dependencies
- Mock data can unblock frontend
- Placeholder endpoints can unblock backend
- Priority on unblocking work

### Risk: Scope Creep
**Mitigation:**
- Strict adherence to P0/P1/P2 priorities
- Daily checkpoint reviews
- Focus on "100% production ready" not "feature complete"
- Cut P2 items if behind schedule

---

## DAILY WORKFLOW

### Morning (Start of Day)
1. Check `.agent-[x]-requests/` for overnight requests
2. Review sync point from previous day
3. Prioritize day's work
4. Begin implementation

### Throughout Day
1. Work on assigned tasks
2. Create requests when blocked
3. Commit regularly with descriptive messages
4. Test continuously

### Evening (End of Day)
1. Complete assigned tasks for the day
2. Run verification commands
3. Write sync point summary
4. Create requests for next day
5. Commit all work
6. Notify other agent of sync point

---

## VERIFICATION CHECKLIST

### Agent A Verification Commands

```bash
# At end of each day:
cd D:\GitHub\TheRxSpot_Marketplace

# Test consult gating bypass prevention
curl -X POST http://localhost:9000/store/carts/cart_123/line-items \
  -H "Content-Type: application/json" \
  -d '{"variant_id": "VARIANT_REQUIRING_CONSULT", "quantity": 1}'
# Expected: 403 Forbidden

# Run migrations
npx medusa db:migrate

# Start backend and verify
npm run dev
# Check: No startup errors
# Check: All routes registered
```

### Agent B Verification Commands

```bash
# At end of each day:

# Storefront
cd D:\GitHub\TheRxSpot_Marketplace\TheRxSpot_Marketplace-storefront
yarn type-check
yarn lint
yarn build

# Tenant Admin
cd D:\GitHub\TheRxSpot_Marketplace\tenant-admin
npm run type-check
npm run lint
npm run build

# Expected: No errors, build succeeds
```

---

## SUCCESS CRITERIA

### Project is Production Ready When:

**Security (Agent A):**
- [ ] API bypass attempts return 403
- [ ] JWT/COOKIE secrets are cryptographically strong
- [ ] All PHI access is audit logged
- [ ] Rate limiting on auth endpoints

**Backend (Agent A):**
- [ ] All migrations run successfully
- [ ] Consultation lifecycle complete
- [ ] Order status machine integrated
- [ ] Earnings calculate correctly
- [ ] Documents store securely
- [ ] All integration tests pass

**Frontend (Agent B):**
- [ ] Routes consolidated, no conflicts
- [ ] Build passes TypeScript + ESLint strict
- [ ] Order detail page functional
- [ ] Consultation status visible
- [ ] Earnings dashboard displays
- [ ] All E2E tests pass

**Integration:**
- [ ] Frontend connects to backend
- [ ] All critical user flows work
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Cross-browser compatible

---

## EMERGENCY PROCEDURES

### If Agent A is Blocked
1. Create placeholder/mock endpoints for Agent B
2. Document what's mocked
3. Implement real endpoints as priority

### If Agent B is Blocked
1. Use mock data for UI development
2. Create detailed request for Agent A
3. Focus on UI components that don't need data

### If Critical Bug Found
1. Stop current work
2. Create bug report in `.bug-reports/`
3. Owner agent fixes immediately
4. Other agent continues parallel work

### If Behind Schedule
1. Cut P2 (nice-to-have) features
2. Focus on P0 (critical) only
3. Extend Day 4 if needed
4. Document what's deferred

---

## POST-DEVELOPMENT

### After Day 4:

1. **Code Review:**
   - Agent A reviews Agent B's changes
   - Agent B reviews Agent A's changes
   - Address any issues found

2. **Final Testing:**
   - Full integration test suite
   - Security penetration test
   - Performance test

3. **Deployment:**
   - Create production build
   - Deploy to staging
   - Run smoke tests
   - Deploy to production

4. **Documentation:**
   - Update README.md
   - Update API documentation
   - Create deployment guide

---

## CONTACT & ESCALATION

**If you need help:**
1. Check your assigned plan document
2. Look for examples in the codebase
3. Check the request directory
4. Create a detailed request

**If completely stuck:**
1. Document what you've tried
2. Document the exact error
3. Create emergency request
4. Continue with other tasks

---

**PLAN STATUS:** APPROVED FOR EXECUTION
**START DATE:** 2026-02-03
**TARGET COMPLETION:** 2026-02-07
**NEXT ACTION:** Both agents begin Day 1 tasks

---

*This coordination plan ensures parallel execution with zero conflicts.*
*Follow your assigned plan document precisely.*
*Communicate via the request directory.*
*Sync daily at the defined checkpoints.*
