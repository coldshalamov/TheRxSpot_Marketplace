# Documentation vs Implementation Analysis Report

**Project:** TheRxSpot Marketplace  
**Analysis Date:** 2026-02-03  
**Analyzed By:** Agent C - Documentation Detective  

---

## Executive Summary

The codebase represents a **multi-tenant telehealth marketplace platform** built on Medusa.js v2.13.1 with a Next.js storefront. While the core foundation is in place with Business/Location models, tenant resolution, and basic consult submission flow, **significant gaps exist** between documented features and actual implementation.

**Overall Status:** ~35% Complete (Core Foundation Laid)

---

## Feature Implementation Matrix

| # | Feature | Doc Status | Actual Status | Gap |
|---|---------|------------|---------------|-----|
| 1 | **Sales Channel per Business** | Required | **IMPLEMENTED** | ✅ Complete |
| 2 | **Publishable API Key per Business** | Required | **IMPLEMENTED** | ✅ Complete |
| 3 | **Location-Product Assignment** | Required | **MISSING** | ❌ No link table exists |
| 4 | **Consultation Module (Models)** | Required | **PARTIAL** | ⚠️ Only ConsultSubmission exists |
| 5 | **Consult Gating (Server-Side)** | Required | **MISSING** | ❌ UI-only enforcement |
| 6 | **Earnings/Payouts Module** | Required | **MISSING** | ❌ No models/routes |
| 7 | **Document Storage Integration** | Required | **MISSING** | ❌ Not implemented |
| 8 | **Audit Logging** | Required | **MISSING** | ❌ Not implemented |
| 9 | **Video/Audio Session Integration** | Required | **MISSING** | ❌ No VisitSession model |
| 10 | **Tenant-Scoped Admin UI** | Required | **PARTIAL** | ⚠️ Basic tenant portal exists |
| 11 | **Coupons/Promotions Tenant Scoping** | Required | **UNKNOWN** | ❓ Uses native Medusa (unverified) |
| 12 | **Order Status Machine** | Required | **MISSING** | ❌ No custom statuses |

---

## Detailed Feature Analysis

### 1. Sales Channel per Business ✅

**Implementation Status:** IMPLEMENTED

**Evidence:**
- `Business` model has `sales_channel_id` field
- `provision-business.ts` workflow creates SalesChannel on provision
- Link table `business-sales-channel.ts` exists

**Code Locations:**
- `src/modules/business/models/business.ts:16`
- `src/workflows/provision-business.ts` (lines 40-45, 67-73)
- `src/links/business-sales-channel.ts`

---

### 2. Publishable API Key per Business ✅

**Implementation Status:** IMPLEMENTED

**Evidence:**
- `Business` model has `publishable_api_key_id` field
- Workflow creates API key and links to sales channel
- Storefront URL generated with QR code

**Code Locations:**
- `src/modules/business/models/business.ts:17`
- `src/workflows/provision-business.ts` (lines 50-73)

---

### 3. Location-Product Assignment ❌

**Implementation Status:** MISSING

**Gap Analysis:**
- Location model exists but NO link to Product/ProductVariant
- No API routes for product enablement per location
- Docs specify: "Create a link table (Location <-> Product or Location <-> ProductVariant)"

**Existing Models:**
- `Location` model: `business_id`, `name`, `serviceable_states[]`
- No product assignment logic

**Required Work:**
- Create LocationProduct link table
- Add admin UI for product assignment
- Filter storefront products by location

---

### 4. Consultation Module ⚠️

**Implementation Status:** PARTIAL (Minimal)

**What Exists:**
- `ConsultSubmission` model - form-based submissions only
- Basic CRUD API routes
- Storefront form component (`consult-form.tsx`)

**What's Missing (per docs):**
- ❌ `Consultation` model with status lifecycle
- ❌ `Patient` entity
- ❌ `Clinician` entity + availability
- ❌ `ConsultationStatusEvent` history
- ❌ Status transitions: Scheduled, In Progress, Completed, Incomplete, No Show
- ❌ Modes: Video, Audio, Form (only Form exists)
- ❌ Clinician assignment

**Code Locations:**
- Model: `src/modules/business/models/consult-submission.ts`
- API: `src/api/store/businesses/[slug]/consult/route.ts`
- API: `src/api/admin/consult-submissions/route.ts`

---

### 5. Consult Gating (Server-Side) ❌

**Implementation Status:** MISSING - CRITICAL GAP

**Current State:**
- UI-only gating in storefront (`product-detail.tsx:63-66`)
- Client-side check: `if (product?.requires_consult && !consultApproved)`

**What's Missing:**
- ❌ Server-side enforcement on add-to-cart
- ❌ Checkout validation
- ❌ Order placement validation
- ❌ Consult fee as separate line item
- ❌ `consultation_id` stored on cart/order

**Doc Reference:**
> "Consult gating is UI-only; it must be enforced server-side (cart/checkout/order workflows)"

**Security Risk:** HIGH - API can be called directly to bypass consultation

---

### 6. Earnings/Payouts Module ❌

**Implementation Status:** MISSING

**What Docs Specify:**
- `EarningEntry` model with types (consult_fee, medication_fee, platform_fee, clinician_fee)
- `Payout` model
- Earnings dashboard
- Payout history
- Link to orders

**Current State:**
- No models
- No API routes
- No admin UI
- No workflows generating earning entries

**Code Search:** Zero matches for "EarningEntry" or "Payout" in source code (outside Stripe node_modules)

---

### 7. Document Storage Integration ❌

**Implementation Status:** MISSING

**What Docs Specify:**
- S3-compatible storage integration
- `Document` entity with:
  - `business_id`, `patient_id`, `consultation_id`
  - `type` (lab, intake, prescription)
  - `storage_key`
- Signed URL download endpoints

**Current State:**
- No Document model
- No storage integration (AWS S3 SDK is in node_modules but unused)
- Only reference found: `src/scripts/seed.ts` (irrelevant)

---

### 8. Audit Logging ❌

**Implementation Status:** MISSING

**What Docs Specify:**
- Audit log module for PHI access tracking
- Fields: `actor_id`, `action`, `entity`, `timestamp`
- Compliance-grade access tracking

**Current State:**
- No audit module
- No logging middleware
- No tracking of who accessed what

---

### 9. Video/Audio Session Integration ❌

**Implementation Status:** MISSING

**What Docs Specify:**
- Telehealth provider integration (Twilio/Zoom/Vonage)
- `VisitSession` entity
- `room_id`/`join_url`
- Recording support

**Current State:**
- No VisitSession model
- No telehealth integration
- Only Form mode in ConsultSubmission

---

### 10. Tenant-Scoped Admin UI ⚠️

**Implementation Status:** PARTIAL

**What Exists:**
- Separate `tenant-admin/` Next.js app (basic structure)
- Dashboard showing business name, status, user role
- `/admin/tenant/*` API routes with auth middleware

**What's Missing:**
- ❌ Full feature parity with main admin
- ❌ Consultations list/detail for tenant users
- ❌ Order management (basic route exists but limited)
- ❌ Location management
- ❌ Earnings view
- ❌ User invitation flow
- ❌ Role-based access control (RBAC) enforcement

**Code Locations:**
- Portal: `tenant-admin/src/app/dashboard/page.tsx`
- Middleware: `src/api/middlewares/tenant-admin-auth.ts`
- API: `src/api/admin/tenant/orders/route.ts`

---

### 11. Coupons/Promotions Tenant Scoping ❓

**Implementation Status:** UNKNOWN

**Analysis:**
- Docs specify using Medusa promotions scoped by sales channel
- Medusa native promotions exist but tenant scoping not verified
- No custom code found for coupon management

**Code Search:** No custom coupon/promotion routes found in `src/api/`

---

### 12. Order Status Machine ❌

**Implementation Status:** MISSING

**What Docs Specify:**
- Custom order statuses: consult_pending, consult_complete, medication_ordered, shipped, delivered
- Workflow for state transitions
- Order Items tab for per-med tracking

**Current State:**
- Using native Medusa Order statuses only
- No custom status machine
- Link table exists for Business-Order but no status workflow

---

## Models Implementation Status

| Model | Status | Location |
|-------|--------|----------|
| Business | ✅ Implemented | `src/modules/business/models/business.ts` |
| Location | ✅ Implemented | `src/modules/business/models/location.ts` |
| BusinessDomain | ✅ Implemented | `src/modules/business/models/business-domain.ts` |
| BusinessUser | ✅ Implemented | `src/modules/business/models/business-user.ts` |
| ProductCategory | ✅ Implemented (custom) | `src/modules/business/models/product-category.ts` |
| ConsultSubmission | ✅ Implemented | `src/modules/business/models/consult-submission.ts` |
| Consultation | ❌ Missing | Not found |
| Patient | ❌ Missing | Not found |
| Clinician | ❌ Missing | Not found |
| ConsultationStatusEvent | ❌ Missing | Not found |
| LocationProduct | ❌ Missing | Not found |
| EarningEntry | ❌ Missing | Not found |
| Payout | ❌ Missing | Not found |
| Document | ❌ Missing | Not found |
| AuditLog | ❌ Missing | Not found |
| VisitSession | ❌ Missing | Not found |

---

## Top 5 Missing Features (Ranked by Criticality)

### 1. **Server-Side Consult Gating** 🔴 CRITICAL
**Why:** Current UI-only gating is a security vulnerability. Users can bypass consultation requirements by calling the API directly.

**Impact:** Compliance risk, patient safety, regulatory violations

**Implementation Needed:**
- Cart validation workflow
- Checkout session validation
- Order placement hooks
- Middleware enforcement

---

### 2. **Consultation Module Completion** 🔴 CRITICAL
**Why:** Core telehealth functionality missing. Only form submissions exist; no full consultation lifecycle.

**Impact:** Cannot conduct video/audio consultations, track status changes, assign clinicians

**Implementation Needed:**
- Full Consultation model with status machine
- Clinician entity and availability
- Status history tracking
- Video/audio integration hooks

---

### 3. **Earnings/Payouts Module** 🟠 HIGH
**Why:** Financial tracking is essential for marketplace operations. Businesses cannot see earnings.

**Impact:** Cannot pay businesses, track commissions, generate financial reports

**Implementation Needed:**
- EarningEntry and Payout models
- Workflow hooks on order/consult completion
- Admin UI for earnings dashboard
- Payout processing job

---

### 4. **Document Storage** 🟠 HIGH
**Why:** Telehealth requires medical document management (prescriptions, lab results, intake forms).

**Impact:** Cannot store patient records, prescriptions, compliance documentation

**Implementation Needed:**
- Document model
- S3/storage integration
- Signed URL endpoints
- PHI-compliant access controls

---

### 5. **Location-Product Assignment** 🟡 MEDIUM
**Why:** Products must be assignable per location with serviceable state gating.

**Impact:** All products appear at all locations; no catalog segmentation

**Implementation Needed:**
- Location-Product link table
- Admin UI for assignment
- Storefront filtering by location
- Serviceable states validation

---

## Gotchas & Issues Called Out in Docs

### 1. **Next.js Layout Structure Issue**
> "Next.js App Router: nested `app/[businessSlug]/layout.tsx` should NOT render `<html>`/`<head>`/`<body>`; only root layout does."

**Status:** ⚠️ Verify in storefront code

---

### 2. **Custom HTML Injection Security**
> "Injecting arbitrary HTML into `<head>` must be done safely (sanitize) and in valid Next.js patterns."

**Current State:** `custom_html_head` and `custom_html_body` fields exist on Business model but sanitization not verified.

---

### 3. **Product Filtering Not Wired**
> "Product filtering by business is not actually wired to Medusa sales channels/publishable keys."

**Status:** ⚠️ Partial - Sales channels created but storefront filtering implementation unclear

---

### 4. **Database Migrations**
> "Database migrations for custom models are not generated/applied."

**Status:** ❌ Unknown if migrations exist

---

### 5. **Admin UI Extensions**
> "Admin UI extensions need proper route registration and may require icons/import fixes."

**Status:** ⚠️ Basic admin pages exist but may have issues

---

## Recommendations for Priority Order

### Phase 1: Security & Compliance (Weeks 1-2)
1. **Implement server-side consult gating** - Critical security fix
2. **Add audit logging** - Compliance requirement
3. **Document storage with PHI controls** - HIPAA preparation

### Phase 2: Core Features (Weeks 3-4)
4. **Complete Consultation module** - Core business logic
5. **Implement Earnings/Payouts** - Financial operations
6. **Add Location-Product assignment** - Catalog management

### Phase 3: Enhancement (Weeks 5-6)
7. **Video/audio session integration** - Full telehealth
8. **Order status machine** - Order lifecycle
9. **Tenant admin portal completion** - Self-service

### Phase 4: Polish (Week 7)
10. **Fix Next.js layout issues**
11. **Add comprehensive tests**
12. **Performance optimization**

---

## Test Coverage Analysis

**Existing Tests:**
- ✅ `provisioning.spec.ts` - Business provisioning flow
- ✅ `tenant-isolation.spec.ts` - Tenant resolution middleware
- ✅ `admin-tenant-scoping.spec.ts` - Admin access control
- ✅ `health.spec.ts` - Basic health checks

**Missing Test Coverage:**
- ❌ Consultation workflow tests
- ❌ Cart/checkout gating tests
- ❌ Order status transition tests
- ❌ Earnings calculation tests
- ❌ Document upload/download tests
- ❌ Video session integration tests

---

## API Routes Summary

### Admin Routes (Implemented)
| Route | Method | Status |
|-------|--------|--------|
| `/admin/businesses` | CRUD | ✅ |
| `/admin/businesses/[id]/provision` | POST | ✅ |
| `/admin/businesses/[id]/status` | POST | ✅ |
| `/admin/businesses/[id]/domains` | CRUD | ✅ |
| `/admin/businesses/[id]/locations` | CRUD | ✅ |
| `/admin/businesses/[id]/qr-code` | GET/POST | ✅ |
| `/admin/consult-submissions` | GET | ⚠️ (list only) |
| `/admin/consult-submissions/[id]` | GET/PATCH | ⚠️ (basic) |
| `/admin/tenant/me` | GET | ✅ |
| `/admin/tenant/orders` | GET | ⚠️ (basic) |
| `/admin/tenant/users` | CRUD | ✅ |

### Store Routes (Implemented)
| Route | Method | Status |
|-------|--------|--------|
| `/store/businesses` | GET | ✅ |
| `/store/businesses/[slug]` | GET | ✅ |
| `/store/businesses/[slug]/locations` | GET | ✅ |
| `/store/businesses/[slug]/consult` | POST | ⚠️ (form only) |
| `/store/tenant-config` | GET | ✅ |

---

## Conclusion

The codebase has a **solid foundation** with proper Medusa v2 architecture, tenant resolution, and business provisioning. However, it is approximately **35% complete** relative to the documented feature set.

**Critical gaps** around consult gating security and consultation module completion must be addressed before production deployment. The current UI-only gating is a significant vulnerability that could expose the platform to compliance violations.

**Recommendation:** Prioritize Phase 1 (Security & Compliance) features before adding new functionality.

---

*Report generated by Agent C: Documentation Detective*  
*Analysis based on DEV_CHECKLIST.md and FEATURES_AND_MEDUSA_MAPPING.md vs actual codebase*
