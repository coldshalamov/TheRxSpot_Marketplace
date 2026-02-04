# TheRxSpot Marketplace - EXECUTION QUICKSTART
## Immediate Action Checklist

---

## PRE-FLIGHT CHECKLIST (Before Starting)

### Environment Setup
```powershell
# 1. Start infrastructure
cd D:\GitHub\TheRxSpot_Marketplace
docker-compose up -d

# 2. Verify services
# PostgreSQL: localhost:5432
# Redis: localhost:6379

# 3. Install dependencies
npm install

# 4. Run seed (if needed)
npm run seed
```

### File Cleanup (5 minutes)
```powershell
# Delete these to save 53MB:
# - medusa-develop.zip (49MB)
# - nextjs-starter-medusa-main.zip (1.7MB)
# - b2b-starter-medusa-main.zip (extract useful first, then delete)
```

### Create Communication Directories
```powershell
mkdir .agent-a-requests
mkdir .agent-b-requests
mkdir .sync-points
```

---

## AGENT A (CLAUDE) - START HERE

### Immediate First Tasks (Do These Now)

**Task 1: Server-Side Consult Gating (CRITICAL)**
```
Create these files:
1. src/modules/business/models/consult-approval.ts
2. src/api/middlewares/consult-gating.ts
3. Extend cart creation to validate consult requirements

GOAL: API calls to add consult-required products WITHOUT approval return 403
```

**Task 2: Generate Strong Secrets**
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy output to .env for JWT_SECRET and COOKIE_SECRET
```

**Task 3: Create Database Migrations**
```bash
npx medusa migration generate
npx medusa db:migrate
```

### Your Plan Document
📄 `PLAN_AGENT_A_CLAUDE_BACKEND_CORE.md`

### Use Subagents For Parallelization
```
Subagent 1: Security & Consult Gating (A1.1, A1.3)
Subagent 2: Models & Migrations (A1.2, A2.1, A3.2, A4.1, A4.2)
Subagent 3: API Routes (A2.2, A3.3, A4.1)
Subagent 4: Workflows & Jobs (A1.4, A3.1, A3.2)
You: Integration & Testing (A5.1, A5.2)
```

---

## AGENT B (GLM 4.7) - START HERE

### Immediate First Tasks (Do These Now)

**Task 1: Delete Conflicting Routes (CRITICAL)**
```
Delete these files:
- src/app/[businessSlug]/page.tsx
- src/app/[businessSlug]/products/page.tsx
- src/app/[businessSlug]/products/[productId]/page.tsx
- src/app/business/[businessSlug]/layout.tsx

KEEP ONLY: src/app/[countryCode]/(tenant)/*
```

**Task 2: Enable Strict Build Checks**
```javascript
// next.config.js - change these:
eslint: { ignoreDuringBuilds: false },
typescript: { ignoreBuildErrors: false }
```

**Task 3: Fix All TypeScript Errors**
```bash
cd TheRxSpot_Marketplace-storefront
yarn type-check 2>&1 | head -50
# Fix every error reported
```

**Task 4: Create Order Detail Page (CRITICAL)**
```
File: tenant-admin/src/app/dashboard/orders/[id]/page.tsx
Currently: EMPTY
Need: Full order detail with status actions
```

### Your Plan Document
📄 `PLAN_AGENT_B_GLM_FRONTEND_PORTAL.md`

---

## COORDINATION PROTOCOL

### Communication Method
```
If Agent A needs something from Agent B:
→ Create file in .agent-b-requests/001-description.md

If Agent B needs something from Agent A:
→ Create file in .agent-a-requests/001-description.md
```

### Request Template
```markdown
# Request: [Brief Title]
**From:** Agent A/B
**To:** Agent B/A
**Priority:** P0/P1/P2
**Deadline:** End of Day X

## What I Need
Clear description

## Suggested Implementation
Code example if applicable

## Acceptance Criteria
- [ ] Item 1
- [ ] Item 2
```

---

## DAILY CHECKPOINT FORMAT

### At End of Each Day, Create:
`D:\GitHub\TheRxSpot_Marketplace\.sync-points\day-X-checkpoint.md`

```markdown
# Day X Checkpoint - [Agent A/B]

## Completed
- [ ] Task 1
- [ ] Task 2

## In Progress
- Task 3 (70% complete)

## Blocked/Issues
- Issue description

## Requests for Other Agent
- Request 1

## Verification Results
```bash
# Paste output of verification commands
```

## Tomorrow's Plan
- Task 4
- Task 5
```

---

## CRITICAL SUCCESS METRICS

### Agent A - Must Achieve
```
□ Consult gating: API bypass returns 403
□ Secrets: 128+ char random hex
□ Migrations: All run without errors
□ Tests: All pass
```

### Agent B - Must Achieve
```
□ Routes: Single hostname-based structure
□ Build: ESLint + TypeScript strict pass
□ Order detail: Fully functional
□ Consult status: Visible to patients
□ Earnings: Dashboard displays
```

---

## VERIFICATION COMMANDS

### Agent A - Run These Daily
```bash
# Test API bypass is blocked
curl -X POST http://localhost:9000/store/carts/cart_123/line-items \
  -H "Content-Type: application/json" \
  -d '{"variant_id": "CONSULT_PRODUCT", "quantity": 1}'
# MUST return 403

# Run tests
npm run test:integration:modules

# Check migrations
npx medusa db:migrate
```

### Agent B - Run These Daily
```bash
# Storefront
cd TheRxSpot_Marketplace-storefront
yarn type-check
yarn lint
yarn build

# Tenant Admin
cd tenant-admin
npm run type-check
npm run lint
npm run build

# All must pass with 0 errors
```

---

## EMERGENCY CONTACTS

If completely stuck:
1. Document the problem in detail
2. Create request file
3. Continue with other tasks
4. Don't block for more than 30 minutes

---

## LET'S GO!

**Agent A:** Start with A1.1 (Consult Gating) - this is CRITICAL
**Agent B:** Start with B1.1 (Route Consolidation) - this is CRITICAL

Both: Work through your plan documents systematically.

**Remember:**
- Parallel execution, zero conflicts
- Daily sync points
- Requests via directory, not direct modification
- P0 items first, P1 second, P2 if time permits

---

**READY TO EXECUTE**
**GO GO GO! 🚀**
