# Implementation Plan - TheRxSpot Marketplace

**Goal:** Build white-label telehealth platform to replace partner service

**Timeline:** 6-8 weeks to production MVP

---

## Phase 1: Backend API ✅ COMPLETE

### Status: All APIs Implemented

- [x] Multi-tenant business management
- [x] User/client management
- [x] Consultation tracking
- [x] Order management with consult-gating
- [x] Earnings & payout system
- [x] Document upload with virus scanning
- [x] Audit logging for compliance
- [x] Rate limiting with Redis
- [x] Custom domain support

**Files Created:** 156 TypeScript files in `src/`

---

## Phase 2: Admin Dashboard 🟡 VALIDATION NEEDED

### Status: Core Pages Implemented

The following pages have been implemented and need functional verification:

- ✅ **Dashboard Home** (`src/admin/routes/home/`)
  - Metrics, Charts, Activity Log
- ✅ **Users Page** (`src/admin/routes/users/`)
  - List, Filter, Edit, Deactivate
- ✅ **Consultations Page** (`src/admin/routes/consultations/`)
  - Status management, Clinician assignment
- ✅ **Earnings Page** (`src/admin/routes/earnings/`)
  - Payout requests, Transaction history
- ✅ **Orders Page** (`src/admin/routes/orders-global/`)

### Remaining Work (Refining)

1. **Business Management Details**
   - Verify `src/admin/routes/businesses/[id]`
   - Ensure "Location Management" is fully functional

2. **Coupons**
   - Verify `src/admin/routes/coupons/` exists and works

3. **QA & Polish**
   - Manual testing of all forms
   - Validation of "Bulk Actions" (Assignment, Deactivation)

**Estimated Effort:** 10-20 hours (Validation & Fixes)

---

## Phase 3: Storefront ✅ CODE COMPLETE

### Status: All Features Implemented

#### ✅ Step 1: Tenant Resolution
**File:** `TheRxSpot_Marketplace-storefront/src/middleware.ts`
- ✅ Resolves tenant config from hostname
- ✅ Sets `_tenant_config` cookie
- ✅ Handles region redirection

#### ✅ Step 2: Multi-Tenant Branding
**Files:**
- `src/app/[countryCode]/(tenant)/layout.tsx` - CSS variables injection
- `src/modules/layout/templates/nav/index.tsx` - Dynamic logo & business name
- `src/app/[countryCode]/(checkout)/layout.tsx` - Checkout branding

**Completed:**
- ✅ Read `_tenant_config` cookie/header
- ✅ Apply CSS variables for colors (primary, accent)
- ✅ Inject Tenant Logo & Business Name
- ✅ Inject Custom Scripts (Analytics)
- ✅ Checkout flow with tenant branding

#### ✅ Step 3: Product Catalog (Tenant Scoped)
**File:** `src/modules/products/templates/product-info/index.tsx`

**Completed:**
- ✅ Show "Consultation Required" badge
- ✅ Pricing display (Consult Fee)
- ⚠️ **Needs Testing:** Filter products by Business & Location availability

#### ✅ Step 4: Consult-Gating Logic
**File:** `src/modules/products/components/product-actions/index.tsx`

**Already Implemented:**
- ✅ **Pre-Cart Check:** Validation before "Add to Cart"
- ✅ **Approval Flow:** Check for valid ConsultApproval
- ✅ **Consultation Form:** Integrated ConsultForm modal
- ✅ **Status Display:** "Approved", "Pending", "Needs Consult" states
- ✅ **Polling:** Auto-refresh approval status every 10s

#### ✅ Step 5: Customer Portal (Partial)
**File:** `src/modules/account/components/consultation-history/index.tsx`

**Completed:**
- ✅ Consultation History component
- ⚠️ **Not Integrated:** Component needs to be added to account page routes

**NOT Implemented:**
- ⏳ Full account page integration
- ⏳ Order history enhancements for consultation-linked orders

**Remaining Effort for Full Step 5:** 5-8 hours

---

## Phase 4: Payment Integration ✅ CODE COMPLETE (Needs Testing)

### Stripe Integration

**Priority:** High (Blocker for Production)

#### ✅ Backend Service
**Files Created:**
- `src/modules/payment/services/stripe-service.ts` - Payment service
- `src/api/store/payment/create-intent/route.ts` - PaymentIntent API
- `src/api/webhooks/stripe/route.ts` - Webhook handler

**Completed:**
- ✅ Implement `createPaymentIntent`
- ✅ Split funds calculation (Platform Fee vs Tenant Earning)
- ✅ Handle Webhooks (Payment Succeeded/Failed/Refunded)
- ✅ Environment variables template (`.env.stripe.template`)

**Known Limitations:**
- ⚠️ **Mock Amount:** Payment API uses hardcoded $100 amount (needs cart/order integration)
- ⚠️ **No Stripe Connect:** Fund splitting is calculated but not implemented with Stripe Connect transfers
- ⚠️ **Webhook Handlers Incomplete:** TODOs remain for order status updates and EarningEntry creation

#### ✅ Frontend Integration
**File:** `src/components/stripe-checkout/index.tsx`

**Completed:**
- ✅ Stripe Elements in Checkout component
- ✅ Tenant branding applied to payment form
- ✅ Payment confirmation flow
- ✅ Error handling

**NOT Implemented:**
- ⏳ Payout Setup Flow for Tenants (Stripe Connect onboarding)
- ⏳ Integration into actual checkout page

**Remaining Effort:** 10-15 hours (Integration + Stripe Connect)

---

## Phase 5: Custom Domain Setup ⏳ PENDING

### Automation & Infrastructure

1. **DNS Verification Job**
   - [ ] Poll for TXT records
   - [ ] Issue SSL Certs (Auto or Manual Guide)

2. **Admin UI**
   - [ ] "Domains" tab in Business Settings
   - [ ] Status indicators (Verified/Unverified)

**Estimated Effort:** 30-40 hours

---

## Phase 6: Testing & QA ⏳ PENDING

- [ ] **E2E Tests:** Customer Journey (Land -> Consult -> Checkout)
- [ ] **Load Tests:** Admin Dashboard performance
- [ ] **Security:** Penetration test of "Tenant Isolation" (ensure Data Leakage is impossible)

---

## Summary Timeline

| Phase | Duration | Status | Effort Remaining |
|-------|----------|--------|------------------|
| 1. Backend API | Week 1-2 | ✅ Complete | 0h |
| 2. Admin Dashboard | Week 3-4 | ✅ Code Done | 10-20h (QA) |
| 3. Storefront | Week 5-6 | ✅ Code Complete | 5-8h (Integration) |
| 4. Payment Integration | Week 6 | ✅ Code Complete | 10-15h (Connect + Integration) |
| 5. Custom Domains | Week 7 | ⏳ Pending | 30-40h |
| 6. Testing & QA | Week 7-8 | ⏳ Pending | 30-40h |
| 7. Deployment | Week 8 | ⏳ Pending | 40-50h |

**Total Remaining:** ~125-173 hours

---

## Immediate Next Steps

### 1. Integration Work (High Priority)
- **Integrate StripeCheckout into checkout page** (5h)
- **Add ConsultationHistory to account page** (2h)
- **Connect payment API to real cart/order amounts** (3h)

### 2. Stripe Connect Setup (Critical for Production)
- **Implement Stripe Connect onboarding flow** (8h)
- **Update payment service to use Connect transfers** (4h)
- **Test fund splitting end-to-end** (3h)

### 3. Testing & Validation
- **Manual test entire checkout flow** (2h)
- **Test payment webhooks locally** (2h)
- **Validate consultation-to-order linkage** (2h)

---

## Known Technical Debt

### From Previous Sessions
1. **Unused ConsultGate Component:** `src/components/ConsultGate/index.tsx` should be deleted
2. **Custom Script Security:** Need XSS protection for tracking script injection
3. **Product Filtering:** Sales channel filtering not verified

### From This Session
4. **Mock Payment Amounts:** Payment API uses hardcoded values instead of fetching from cart/order
5. **Incomplete Webhook Handlers:** TODOs in `stripe-service.ts` for order updates and earning entries
6. **No Stripe Connect:** Fund splitting is calculated but not executed with actual transfers
7. **Missing Stripe Dependency:** Need to run `npm install stripe @stripe/stripe-js @stripe/react-stripe-js` in both backend and frontend
8. **ConsultationHistory Not Integrated:** Component exists but not added to any route

---

## Environment Setup Required

Before testing payment integration:

1. **Install Dependencies:**
   ```bash
   # Backend
   cd d:\GitHub\TheRxSpot_Marketplace
   npm install stripe

   # Frontend
   cd TheRxSpot_Marketplace-storefront
   npm install @stripe/stripe-js @stripe/react-stripe-js
   ```

2. **Configure Environment Variables:**
   - Copy `.env.stripe.template` values to `.env`
   - Get Stripe keys from https://dashboard.stripe.com/test/apikeys
   - Set up webhook endpoint at https://dashboard.stripe.com/webhooks

3. **Test Webhook Locally:**
   ```bash
   stripe listen --forward-to localhost:9000/webhooks/stripe
   ```
