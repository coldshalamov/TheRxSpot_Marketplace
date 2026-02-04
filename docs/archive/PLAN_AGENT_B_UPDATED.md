# AGENT B - UPDATED EXECUTION PLAN
## TheRxSpot Marketplace Frontend - Recovery & Completion Plan

**Status:** URGENT - Critical Issues Require Immediate Attention  
**Original Plan Status:** 45% Complete, Build Failing  
**Target Completion:** 10 Days  
**Goal:** Production-Ready Frontend

---

## 🚨 IMMEDIATE ACTION REQUIRED

### BEFORE YOU START - CRITICAL FIXES

**DO NOT PROCEED WITH NEW FEATURES UNTIL THESE ARE FIXED:**

#### Fix 1: Triplicate Code (BLOCKING BUILD)

**File:** `tenant-admin/src/app/dashboard/consultations/page.tsx`

**Problem:** The same component is defined 3 times (lines 1-111, 113-221, 223-331)

**Fix Instructions:**
```bash
# Option A: Manual Fix
1. Open tenant-admin/src/app/dashboard/consultations/page.tsx
2. Keep ONLY lines 1-111 (first component)
3. DELETE lines 113-331 (duplicates)
4. Save file

# Option B: Use this script
head -n 111 tenant-admin/src/app/dashboard/consultations/page.tsx > temp.tsx
mv temp.tsx tenant-admin/src/app/dashboard/consultations/page.tsx
```

**Verify Fix:**
```bash
cd tenant-admin
npm run build
# Should show no "duplicate export" errors
```

**Do the same for:**
- `tenant-admin/src/app/dashboard/earnings/page.tsx`

---

#### Fix 2: Duplicate Functions in API Files

**Files:**
- `tenant-admin/src/lib/api.ts` (lines 1-167 and 155-306 are duplicates)
- `TheRxSpot_Marketplace-storefront/src/lib/data/consultations.ts` (multiple duplicates)

**Fix Instructions:**
```bash
# For tenant-admin/src/lib/api.ts:
# Keep only lines 1-167, delete the rest
head -n 167 tenant-admin/src/lib/api.ts > temp.ts
mv temp.ts tenant-admin/src/lib/api.ts

# For storefront consultations.ts:
# Identify and remove duplicate function definitions
```

---

#### Fix 3: SDK Configuration

**File:** `TheRxSpot_Marketplace-storefront/src/lib/config.ts`

**Add session auth:**
```typescript
export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  // ADD THIS LINE:
  auth: { type: "session" }
})
```

---

## 📋 UPDATED PHASES

### PHASE 0: EMERGENCY FIXES (Day 1) - MUST COMPLETE

| Task | File | Action | Verification |
|------|------|--------|--------------|
| P0.1 | consultations/page.tsx | Remove duplicates (keep lines 1-111) | `npm run build` passes |
| P0.2 | earnings/page.tsx | Remove duplicates | No "duplicate export" error |
| P0.3 | lib/api.ts | Remove duplicates | No redeclaration errors |
| P0.4 | lib/data/consultations.ts | Fix duplicates | No redeclaration errors |
| P0.5 | lib/config.ts | Add session auth | TypeScript compiles |
| P0.6 | next.config.js | Enable strict mode | See config below |

**next.config.js Update:**
```javascript
module.exports = {
  // ... existing config
  eslint: { 
    ignoreDuringBuilds: false  // CHANGE FROM true
  },
  typescript: { 
    ignoreBuildErrors: false    // CHANGE FROM true
  },
}
```

**Checkpoint 0:**
- [ ] Both storefront and tenant-admin build successfully
- [ ] `npm run type-check` has 0 errors
- [ ] `npm run lint` has 0 errors

**STOP:** Do not proceed until Checkpoint 0 is complete!

---

### PHASE 1: CORE FEATURES (Days 2-5)

#### Day 2: Consultation Management

**Morning (4 hours):**

**Task 1.1: Consultation Detail Page (Tenant Admin)**
```
File: tenant-admin/src/app/dashboard/consultations/[id]/page.tsx (NEW)

Features:
- Display consultation details
- Show patient information
- Show assigned clinician (if any)
- Status change buttons (Assign, Start, Complete, Cancel)
- Display consultation notes/outcome

API Endpoint: GET /admin/tenant/consultations/:id
```

**Task 1.2: Assign Clinician Modal**
```
File: tenant-admin/src/components/modals/assign-clinician-modal.tsx (NEW)

Features:
- List available clinicians
- Select clinician
- Submit assignment
- Show success/error feedback

API Endpoint: POST /admin/tenant/consultations/:id/assign
```

**Afternoon (4 hours):**

**Task 1.3: Complete Consultation Modal**
```
File: tenant-admin/src/components/modals/complete-consultation-modal.tsx (NEW)

Features:
- Select outcome (approved/rejected/requires_followup)
- Enter notes
- Select approved medications
- Submit completion

API Endpoint: POST /admin/tenant/consultations/:id/complete
```

**Task 1.4: Consultation Status Badge Updates**
```
File: tenant-admin/src/components/consultation-status-badge.tsx (NEW)

Colors:
- draft: gray
- scheduled: blue
- in_progress: yellow
- completed: green
- incomplete: orange
- no_show: red
- cancelled: gray
- rejected: red
```

**Checkpoint 1:**
- [ ] Consultation detail page works
- [ ] Can assign clinician
- [ ] Can complete consultation
- [ ] Status badges display correctly

---

#### Day 3: Order Management

**Morning (4 hours):**

**Task 2.1: Complete Order Detail Page**
```
File: tenant-admin/src/app/dashboard/orders/[id]/page.tsx (EXISTING - ENHANCE)

Add:
- Order items list with products
- Customer information
- Shipping address
- Payment status
- Linked consultation (if any)
- Order status actions

API Endpoint: GET /admin/tenant/orders/:id
```

**Task 2.2: Order Status Actions**
```
File: tenant-admin/src/components/order-actions.tsx (NEW)

Actions:
- Mark as processing
- Mark as fulfilled
- Add tracking number
- Cancel order
- View invoice

API Endpoints:
- POST /admin/tenant/orders/:id/status
```

**Afternoon (4 hours):**

**Task 2.3: Patient Order Detail Page**
```
File: TheRxSpot_Marketplace-storefront/src/app/[countryCode]/(main)/account/@dashboard/orders/details/[id]/page.tsx (EXISTING - ENHANCE)

Add:
- Order timeline/status
- Tracking information
- Reorder button
- Contact support
```

**Task 2.4: Order Consult Status Integration**
```
File: TheRxSpot_Marketplace-storefront/src/components/order-consult-status.tsx (NEW)

Features:
- Show if order requires consultation
- Show consultation status
- Link to consultation details
- Show approval expiration
```

**Checkpoint 2:**
- [ ] Order detail shows all information
- [ ] Can change order status
- [ ] Patient can view order + consult status

---

#### Day 4: Earnings & Payouts

**Morning (4 hours):**

**Task 3.1: Fix Earnings Dashboard**
```
File: tenant-admin/src/app/dashboard/earnings/page.tsx (FIX EXISTING)

Fix:
- Remove duplicate code
- Add real data fetching
- Add error handling
- Add loading states

API Endpoints:
- GET /admin/tenant/earnings/summary
- GET /admin/tenant/earnings
```

**Task 3.2: Payout Request Modal**
```
File: tenant-admin/src/components/modals/payout-request-modal.tsx (NEW)

Features:
- Show available amount
- Input amount to withdraw
- Select payout method
- Confirm and submit
- Show success/error

API Endpoint: POST /admin/tenant/payouts/request
```

**Afternoon (4 hours):**

**Task 3.3: Earnings Chart Component**
```
File: tenant-admin/src/components/earnings-chart.tsx (NEW)

Features:
- Line chart of earnings over time
- Filter by date range
- Hover for details
- Export to CSV

Note: Use recharts or chart.js
```

**Task 3.4: Payout History Table**
```
File: tenant-admin/src/app/dashboard/earnings/payouts/page.tsx (NEW)

Features:
- List all payouts
- Filter by status
- View payout details
- Download payout receipts

API Endpoint: GET /admin/tenant/payouts
```

**Checkpoint 3:**
- [ ] Earnings dashboard shows real data
- [ ] Can request payout
- [ ] Payout history displays

---

#### Day 5: Navigation & Dashboard

**Morning (4 hours):**

**Task 4.1: Dashboard Stats Cards**
```
File: tenant-admin/src/app/dashboard/page.tsx (ENHANCE)

Add cards:
- Active Consultations
- Pending Orders
- Available Earnings
- New Messages

API Endpoints:
- GET /admin/tenant/dashboard/stats
```

**Task 4.2: Navigation Updates**
```
File: tenant-admin/src/components/dashboard-nav.tsx (EXISTING - ENHANCE)

Add:
- Consultations link with badge count
- Earnings link with badge
- Notification dropdown
- Quick actions menu
```

**Afternoon (4 hours):**

**Task 4.3: Storefront Navigation Polish**
```
File: TheRxSpot_Marketplace-storefront/src/components/navbar.tsx (ENHANCE)

Add:
- Consultation status in account menu
- Notification indicator
- Business name display
```

**Task 4.4: Error Boundaries**
```
Files:
- tenant-admin/src/app/dashboard/error.tsx (NEW)
- TheRxSpot_Marketplace-storefront/src/app/error.tsx (NEW)

Features:
- Catch runtime errors
- Show user-friendly message
- Retry button
- Log error to monitoring
```

**Checkpoint 4:**
- [ ] Dashboard shows stats
- [ ] Navigation updated
- [ ] Error boundaries in place

---

### PHASE 2: INTEGRATION & TESTING (Days 6-8)

#### Day 6: API Integration

**Task 5.1: Test All Endpoints**
```
Test each API endpoint:
1. Consultation list - GET /admin/tenant/consultations
2. Consultation detail - GET /admin/tenant/consultations/:id
3. Assign clinician - POST /admin/tenant/consultations/:id/assign
4. Complete consult - POST /admin/tenant/consultations/:id/complete
5. Order list - GET /admin/tenant/orders
6. Order detail - GET /admin/tenant/orders/:id
7. Order status - POST /admin/tenant/orders/:id/status
8. Earnings summary - GET /admin/tenant/earnings/summary
9. Earnings list - GET /admin/tenant/earnings
10. Payout request - POST /admin/tenant/payouts/request
11. Payout list - GET /admin/tenant/payouts
```

**Task 5.2: Fix Integration Issues**
- Handle API errors gracefully
- Add loading states
- Add error messages
- Fix type mismatches

---

#### Day 7: User Flow Testing

**Test Flow 1: Patient Journey**
```
1. Visit pharmacy storefront
2. Browse products
3. Submit consultation for prescription product
4. View consultation status
5. Receive approval notification
6. Purchase product
7. View order status
8. Receive delivery
```

**Test Flow 2: Business/Clinician Journey**
```
1. Login to tenant admin
2. View new consultation
3. Assign to clinician
4. Clinician reviews and approves
5. System creates consult approval
6. Patient completes purchase
7. Business fulfills order
8. Business views earnings
9. Business requests payout
```

**Task 7.3: Fix Issues Found**
- Fix any broken flows
- Add missing error handling
- Polish UI/UX

---

#### Day 8: Testing & Quality

**Task 8.1: Add Component Tests**
```
Files:
- tenant-admin/src/components/__tests__/consultation-status-badge.test.tsx
- tenant-admin/src/components/__tests__/earnings-chart.test.tsx
- storefront/src/components/__tests__/consult-status-badge.test.tsx

Use: React Testing Library + Jest
```

**Task 8.2: Add E2E Tests**
```
Files:
- tests/e2e/patient-consultation-flow.spec.ts
- tests/e2e/business-order-management.spec.ts

Use: Playwright
```

**Task 8.3: Mobile Responsive Testing**
- Test on mobile viewport
- Fix any layout issues
- Ensure touch targets are large enough

---

### PHASE 3: FINAL POLISH (Days 9-10)

#### Day 9: Performance & Accessibility

**Task 9.1: Performance Optimization**
```
- Add lazy loading for heavy components
- Optimize images
- Add loading skeletons
- Implement virtual scrolling for long lists
- Check Core Web Vitals
```

**Task 9.2: Accessibility Audit**
```
- Run axe DevTools
- Fix contrast issues
- Add ARIA labels
- Ensure keyboard navigation works
- Test with screen reader
```

---

#### Day 10: Final Verification

**Task 10.1: Production Build Test**
```bash
cd TheRxSpot_Marketplace-storefront
yarn build
yarn start
# Verify production build works

cd ../tenant-admin
npm run build
npm start
# Verify production build works
```

**Task 10.2: Documentation**
```
- Update README.md with setup instructions
- Document environment variables
- Add deployment instructions
- Create troubleshooting guide
```

**Task 10.3: Create Sync Point**
```
Create file: .sync-points/agent-b-final-checkpoint.md

Include:
- What was completed
- Known issues
- API changes needed from Agent A
- Deployment readiness status
```

---

## 🔗 INTEGRATION WITH AGENT A

### APIs Available from Agent A:

**Consultations:**
- ✅ `GET /admin/tenant/consultations` - List with filters
- ✅ `GET /admin/tenant/consultations/:id` - Get detail
- ✅ `POST /admin/tenant/consultations/:id/assign` - Assign clinician
- ✅ `POST /admin/tenant/consultations/:id/complete` - Complete consult

**Orders:**
- ✅ `GET /admin/tenant/orders` - List orders
- ✅ `GET /admin/tenant/orders/:id` - Get order detail
- ✅ `POST /admin/tenant/orders/:id/status` - Update status

**Earnings:**
- ✅ `GET /admin/tenant/earnings/summary` - Get summary stats
- ✅ `GET /admin/tenant/earnings` - List earnings
- ✅ `POST /admin/tenant/payouts/request` - Request payout
- ✅ `GET /admin/tenant/payouts` - List payouts

**Documents:**
- ✅ `GET /admin/tenant/documents` - List documents
- ✅ `POST /admin/tenant/documents` - Upload document
- ✅ `GET /admin/tenant/documents/:id/download` - Download

**Store (Patient):**
- ✅ `GET /store/consultations` - List my consultations
- ✅ `GET /store/consultations/:id` - Get consultation detail
- ✅ `POST /store/consultations/:id/cancel` - Cancel consultation

### If You Need New APIs:

**Create a request file:**
```bash
touch .agent-b-requests/request-XXX.md
```

**Template:**
```markdown
# Request from Agent B to Agent A
**Priority:** P0/P1/P2
**Date:** 2026-02-XX

## Endpoint Needed
METHOD /path

## Request Body
```json
{}
```

## Response Expected
```json
{}
```

## Reason
Why is this needed?

## Acceptance Criteria
- [ ] Endpoint works
- [ ] Tests pass
```

---

## ✅ SUCCESS CHECKLIST

### Minimum Viable:
- [ ] All builds pass
- [ ] TypeScript has 0 errors
- [ ] ESLint has 0 errors
- [ ] Patient can submit consultation
- [ ] Business can view consultations
- [ ] Business can assign clinician
- [ ] Business can complete consultation
- [ ] Patient can view order status
- [ ] Business can view earnings
- [ ] Business can request payout

### Production Ready:
- [ ] All above plus:
- [ ] Component tests passing
- [ ] E2E tests passing
- [ ] Mobile responsive
- [ ] Accessibility compliant
- [ ] Performance optimized
- [ ] Error boundaries working
- [ ] Loading states implemented
- [ ] Documentation complete

---

## 📞 SUPPORT

### If You Get Stuck:

1. **Build Errors:** Check AGENT_B_WORK_ANALYSIS.md for common issues
2. **API Issues:** Create request in .agent-b-requests/
3. **Integration Help:** Check AGENT_A_EXECUTION_SUMMARY.md for backend docs
4. **Code Examples:** Look at completed files in storefront/account section

### Daily Checklist:

- [ ] Run build before committing
- [ ] Run type-check before pushing
- [ ] Test in browser before considering done
- [ ] Update this plan with progress

---

**REMEMBER:** 
- Fix P0 issues (duplicates) FIRST
- Don't add new features until build passes
- Test each feature as you complete it
- Coordinate with Agent A via .agent-b-requests/

**You've got this! 🚀**
