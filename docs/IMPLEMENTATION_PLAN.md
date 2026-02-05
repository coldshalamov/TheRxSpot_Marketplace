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

## Phase 3: Storefront 🟡 IN PROGRESS

### Status: Tenant Infrastructure Active

- [x] **Step 1: Tenant Resolution** (`src/middleware.ts`)
  - ✅ Resolves tenant config from hostname
  - ✅ Sets `_tenant_config` cookie
  - ✅ Handles region redirection

### Next Steps (Active Development)

#### Step 2: Multi-Tenant Branding
**Target:** `src/app/[countryCode]/(tenant)/layout.tsx`
- [ ] Read `_tenant_config` cookie/header
- [ ] Apply CSS variables for colors (primary, accent)
- [ ] Inject Tenant Logo & Tagline
- [ ] Inject Custom Scripts (Analytics)

#### Step 3: Product Catalog (Tenant Scoped)
**Target:** `src/app/[countryCode]/(tenant)/[business]/[location]/`
- [ ] Filter products by Business & Location availability
- [ ] Show "Consultation Required" badge
- [ ] Pricing display (Consult Fee vs Product Price)

#### Step 4: Consult-Gating Logic
**Component:** `src/components/ConsultGate/`
- [ ] **Pre-Cart Check:** validation before "Add to Cart"
- [ ] **Eligibility Form:** multi-step intake form if required
- [ ] **Cart Line Items:** Separate `consultation_fee` item added automatically

#### Step 5: Checkout & Customer Portal
- [ ] Checkout flow with branding
- [ ] Account page: Order History + Consultation History

**Estimated Effort:** 40-60 hours

---

## Phase 4: Payment Integration ⏳ PENDING

### Stripe Connect Implementation

**Priority:** High (Blocker for Production)

1. **Backend Service** (`src/modules/payment/stripe-service.ts`)
   - [ ] Implement `createPaymentIntent`
   - [ ] Split funds (Platform Fee vs Tenant Earning)
   - [ ] Handle Webhooks (Payment Succeeded/Failed)

2. **Frontend Integration**
   - [ ] Stripe Elements in Checkout
   - [ ] Payout Setup Flow for Tenants (Onboarding)

**Estimated Effort:** 20-30 hours

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

| Phase | Duration | Status | Effort |
|-------|----------|--------|--------|
| 1. Backend API | Week 1-2 | ✅ Complete | Done |
| 2. Admin Dashboard | Week 3-4 | ✅ Validating | 10-20h |
| 3. Storefront | Week 5-6 | 🟡 In Progress | 40-60h |
| 4. Payment Integration | Week 6 | ⏳ Pending | 20-30h |
| 5. Custom Domains | Week 7 | ⏳ Pending | 30-40h |
| 6. Testing & QA | Week 7-8 | ⏳ Pending | 30-40h |
| 7. Deployment | Week 8 | ⏳ Pending | 40-50h |

**Total Remaining:** ~170-230 hours

---

## Immediate Action Plan (Next 3 Days)

1. **Storefront Branding (Step 2)**
   - Implement dynamic layout in `(tenant)` group.
   - Verify logo/color injection works locally.

2. **Consult Gating (Step 4)**
   - Build the "Blocker" component for Product Page.
   - Ensure cart cannot accept Rx items without Consult.

3. **Verify Admin Dashboard**
   - Click through all implemented Admin pages.
   - Fix any crashes/undefined errors.
