# TheRxSpot Marketplace - Medusa V2 Codebase Summary

> **Version:** Medusa V2.13.1  
> **Project Type:** Multi-tenant Healthcare Marketplace with Telehealth Consultations  
> **Last Updated:** 2026-02-06

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Custom Modules](#custom-modules)
3. [API Route Patterns](#api-route-patterns)
4. [Workflows](#workflows)
5. [Jobs & Subscribers](#jobs--subscribers)
6. [Configuration & Wiring](#configuration--wiring)
7. [Key Patterns for Documentation Reference](#key-patterns-for-documentation-reference)

---

## Architecture Overview

This is a **multi-tenant healthcare marketplace** built on Medusa V2 with the following key characteristics:

- **Multi-tenancy**: Businesses (pharmacies/clinics) have isolated data via `business_id` scoping
- **Telehealth Consultations**: Async and real-time consultation workflows with clinician assignment
- **Consultation Gating**: Products requiring prescriptions can only be purchased after approved consultation
- **HIPAA Compliance**: PHI encryption, audit logging, auto-logoff, document access controls
- **Financials**: Complex earnings calculation with platform fees, Stripe fees, and payout workflows
- **Custom Domains**: Businesses can use custom domains with DNS verification

---

## Custom Modules

### 1. Business Module (`src/modules/business/`)

**Purpose:** Core multi-tenant business management, catalog, and patient intake

**Models:**
| Model | Purpose | Key Relationships |
|-------|---------|-------------------|
| `Business` | Tenant definition | Has many Locations, Domains, Users |
| `Location` | Business physical locations | Belongs to Business, has LocationProducts |
| `ProductCategory` | Hierarchical category tree | Self-referential (parent_id), business-scoped |
| `LocationProduct` | Products available at specific locations | Links Location ↔ Medusa Product |
| `ConsultSubmission` | Patient intake forms (PHI encrypted) | Belongs to Business |
| `ConsultApproval` | Prescription approvals linking customer→product | Belongs to Business, expires after 90 days |
| `BusinessDomain` | Custom domains for businesses | Belongs to Business, DNS verification |
| `BusinessUser` | Staff/admin users per business | Belongs to Business |
| `OrderStatusEvent` | Audit trail for order status changes | Belongs to Order, Business |
| `OutboxEvent` | Reliable event dispatch (outbox pattern) | Business-scoped |
| `TemplateConfig` | CMS-style storefront templates | Belongs to Business, versioning |
| `Coupon` | Business-scoped discount codes | Belongs to Business |

**Key Service Methods:**
```typescript
// Business lookup
getBusinessBySlug(slug: string)
getBusinessByDomain(domain: string)
getBusinessByDomainFromTable(domain: string) // Uses BusinessDomain table

// PHI-encrypted consult submissions
listConsultSubmissionsDecrypted(filters, config)
createConsultSubmission(input) // Auto-encrypts PHI fields

// Category management
getCategoryTree(businessId: string) // Returns hierarchical tree
reorderCategories(categoryIds, parentId)

// Location catalog
assignProductToLocation(locationId, productId, categoryId?, customPrice?)
reorderLocationProducts(locationId, productIds)

// Template CMS
getPublishedTemplate(businessId)
createDefaultTemplate(businessId)
publishTemplate(templateId, publishedBy)

// Coupon validation
validateCoupon(businessId, code, orderAmount)
incrementCouponUsage(couponId)
```

**PHI Encryption Pattern:**
- Fields: `customer_email`, `customer_first_name`, `customer_last_name`, `customer_phone`, `customer_dob`, `eligibility_answers`, `chief_complaint`, `medical_history`, `notes`
- Controlled by `PHI_ENCRYPTION_ENABLED` env var
- Encrypted at rest, decrypted on read

---

### 2. Consultation Module (`src/modules/consultation/`)

**Purpose:** Telehealth consultation management with scheduling

**Models:**
| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Consultation` | Core consultation record | business_id, patient_id, clinician_id, status, scheduled_at |
| `Patient` | Patient profiles (PHI encrypted) | business_id, customer_id linkage |
| `Clinician` | Healthcare providers | business_id, is_platform_clinician, status |
| `ClinicianSchedule` | Weekly availability | clinician_id, day_of_week, start_time, end_time |
| `ClinicianAvailabilityException` | One-off availability | clinician_id, date, is_available |
| `ConsultationStatusEvent` | Status change audit | consultation_id, from_status, to_status |

**Key Service Methods:**
```typescript
// Consultation lifecycle
transitionStatus(consultationId, newStatus, changedBy?, reason?)
assignClinician(consultationId, clinicianId)
completeConsultation(consultationId, data, changedBy)
startConsultation(consultationId)
cancelConsultation(consultationId, reason?, changedBy?)

// PHI-encrypted operations (Patient & Consultation)
createPatient(data) // Auto-encrypts
updatePatient(id, data)
listPatients(filters, options) // Auto-decrypts

// Scheduling
getClinicianSchedule(clinicianId, dateFrom?, dateTo?)
getAvailableSlots(clinicianId, dateFrom, dateTo)
```

**Status Transitions:**
```
draft → scheduled, cancelled
scheduled → in_progress, cancelled, no_show
in_progress → completed, incomplete, cancelled
completed, incomplete, no_show, cancelled → (terminal)
```

---

### 3. Financials Module (`src/modules/financials/`)

**Purpose:** Earnings calculation, payout management, and financial reporting

**Models:**
| Model | Purpose | Key Fields |
|-------|---------|------------|
| `EarningEntry` | Per-line-item earnings | business_id, order_id, type, gross_amount, platform_fee, net_amount |
| `Payout` | Payout requests to businesses | business_id, total_amount, fee_amount, status |

**Key Service Methods:**
```typescript
// Earnings calculation (order-level Stripe fee logic)
calculateEarningsOnOrder(order: OrderInput) // Distributes $0.30 fixed fee proportionally
calculateConsultationEarnings(consultation) // 70/30 clinician/business split

// Payout management
createPayout(businessId, earningsIds, requestedBy) // Validates no double-payout
processPayout(payoutId, processedBy)
cancelPayout(payoutId, reason)

// Status transitions
makeEarningsAvailable(orderId) // Called on delivery
cancelEarnings(orderId) // Called on cancel/refund

// Reporting
getEarningsSummary(businessId) // available, pending, lifetime, ytd_payouts
getPlatformEarningsSummary() // Platform-wide totals
getEarningsByPeriod(period, dateFrom?, dateTo?)
validateEarningsForPayout(businessId, earningsIds) // Pre-payout validation
```

**Fee Structure:**
- Platform fee: 10% of gross
- Stripe fee: 2.9% + $0.30 (calculated at ORDER level, distributed proportionally)
- Consultation split: 70% clinician, 30% business (after platform fee)

---

### 4. Compliance Module (`src/modules/compliance/`)

**Purpose:** Document management, audit logging, HIPAA compliance

**Models:**
| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Document` | Medical documents with access controls | business_id, patient_id, storage_key, checksum, access_level |
| `AuditLog` | HIPAA audit trail | actor_type, action, entity_type, risk_level, changes |

**Key Service Methods:**
```typescript
// Document management
uploadDocument(file, metadata, uploadedBy, uploadedByActorType)
getSignedDownloadUrl(documentId, requestedBy, userType, expiresInSeconds?)
downloadDocumentContent(documentId, requestedBy, userType)
removeDocument(id, deletedBy, userType) // Soft delete
verifyDocumentIntegrity(id) // Checksum verification

// Audit logging
logAuditEvent(event: CreateAuditLogDTO)
queryAuditLogs(filters)
getAuditLogStats(filters)
flagAuditLog(id, reason, flagged)

// Storage abstraction (S3/Local)
StorageProvider.upload(key, buffer, metadata)
StorageProvider.getSignedUrl(key, expiresIn)
StorageProvider.download(key)
```

**Document Access Levels:**
- `patient_only` - Patient only
- `clinician` - Patient + assigned clinician
- `business_staff` - Patient + clinician + business staff
- `platform_admin` - All of above + platform admins

---

## API Route Patterns

### Route Structure

```
src/api/
├── admin/           # Admin dashboard API
│   ├── businesses/  # Business CRUD + provisioning
│   ├── consultations/ # Consultation management
│   ├── documents/   # Document upload/management
│   ├── custom/      # Extended Medusa operations
│   └── tenant/      # Tenant-scoped admin routes
├── store/           # Storefront API
│   ├── businesses/  # Public business listings
│   ├── consultations/ # Patient consultation booking
│   └── documents/   # Patient document access
├── webhooks/        # External service webhooks
└── middlewares.ts   # Central middleware configuration
```

### Route Pattern Examples

**Admin CRUD Route** (`src/api/admin/businesses/route.ts`):
```typescript
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const businesses = await businessModuleService.listAndCountBusinesses(filters)
  res.json({ businesses: businesses[0], count: businesses[1] })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { result } = await provisionBusinessWorkflow(req.scope).run({ input: {...} })
  res.status(201).json({ business: result })
}
```

**Store Route with Param** (`src/api/store/businesses/[slug]/route.ts`):
```typescript
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { slug } = req.params
  const business = await businessModuleService.getBusinessBySlug(slug)
  if (!business) return res.status(404).json({ message: "Business not found" })
  res.json({ business })
}
```

### Middleware Stack (`src/api/middlewares.ts`)

| Middleware | Applied To | Purpose |
|------------|------------|---------|
| `requestContextMiddleware` | `/*` | Request ID, tenant_id, user_id for logging |
| `tenantResolutionMiddleware` | `/store/*` | Resolve business from domain/slug headers |
| `autoLogoffMiddleware` | `/store/*`, `/admin/*` | 15-min HIPAA session timeout |
| `consultGatingMiddleware` | `/store/carts*` | Prevent bypass attacks on prescription products |
| `tenantAdminAuthMiddleware` | `/admin/tenant/*` | Scoped admin authentication |
| `auditLoggingMiddleware` | `/admin/consultations*`, `/admin/patients*`, etc. | HIPAA audit trails |
| `authRateLimiter` | `/auth/*` | Auth endpoint protection |

---

## Workflows

### 1. Business Provisioning (`src/workflows/provision-business.ts`)

**Purpose:** Onboard new business tenants

**Steps:**
1. `get-business` - Retrieve business record
2. `create-sales-channels` - Create Medusa Sales Channel
3. `create-api-keys` - Generate publishable API key
4. `link-sales-channels-to-api-key` - Link channel ↔ key
5. `create-default-template` - Create default storefront template
6. `update-business-after-provision` - Save IDs, generate QR code, DNS instructions

**Usage:**
```typescript
const { result } = await provisionBusinessWorkflow(req.scope).run({
  input: { business_id, storefront_base_url }
})
```

### 2. Consult Gating (`src/workflows/consult-gating/index.ts`)

**Purpose:** Enforce prescription requirements on products

**Workflows:**
- `validateConsultApprovalWorkflow` - Check if customer has valid approval for product
- `validateCartCheckoutWorkflow` - FINAL GATE: Validates ALL cart items at checkout
- `createConsultApprovalWorkflow` - Create approval after consultation completion

**Steps:**
1. `check-product-requires-consult` - Check product.metadata.requires_consult
2. `check-consult-approval` - Query ConsultApproval table
3. `validate-cart-consult-approvals` - Cart-level validation (prevents bypass attacks)

### 3. Order Lifecycle (`src/workflows/order-lifecycle/index.ts`)

**Purpose:** Custom order status management with consultation integration

**Custom Statuses:**
```
pending → consult_pending → consult_complete → payment_captured → processing → fulfilled → delivered
                ↓
          consult_rejected → cancelled → refunded
```

**Workflows:**
- `orderStatusTransitionWorkflow` - Validate and execute status transitions
- `initializeOrderWorkflow` - Set initial status (consult_pending if requires consultation)
- `completeConsultationWorkflow` - Advance order after consultation outcome

**Steps:**
1. `validate-status-transition` - Check valid transition, assert consultation approved for fulfillment
2. `create-status-event` - Audit log in OrderStatusEvent table
3. `update-order-status` - Update order.metadata.custom_status
4. `update-earnings-on-delivery` - Make earnings available
5. `cancel-earnings` - Reverse earnings on cancel/refund

---

## Jobs & Subscribers

### Scheduled Jobs (`src/jobs/`)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `process-payouts` | Daily 2 AM UTC | Process pending payouts with risk-based hold periods (14-30 days) |
| `domain-verification` | Every 5 minutes | Verify custom domain DNS records (CNAME/A) |
| `dispatch-outbox-events` | Custom | Process outbox event dispatch |
| `process-consult-submission` | Custom | Handle consult submission queue |

### Subscribers (`src/subscribers/`)

| Subscriber | Event | Purpose |
|------------|-------|---------|
| `order-placed` | `order.placed` | Create earnings, send emails, update stats |
| `order-delivered` | `order.delivered` | Make earnings available |
| `order-status-changed` | `order.status_changed` | Audit logging |
| `order-created` | `order.created` | Initialize custom status |
| `consultation-completed` | `consultation.completed` | Update order status, create approvals, create earnings |
| `consult-submission-created` | `consult-submission.created` | Queue for review |
| `business-status-changed` | `business.status_changed` | Notifications |

---

## Configuration & Wiring

### Module Registration (`medusa-config.ts`)

```typescript
modules: {
  businessModuleService: {
    resolve: "./src/modules/business",
    definition: { isQueryable: true }
  },
  consultationModuleService: {
    resolve: "./src/modules/consultation",
    definition: { isQueryable: true }
  },
  financialsModuleService: {
    resolve: "./src/modules/financials",
    definition: { isQueryable: true }
  },
  complianceModuleService: {
    resolve: "./src/modules/compliance",
    definition: { isQueryable: true }
  },
}
```

### Module Constants

```typescript
// src/modules/business/index.ts
export const BUSINESS_MODULE = "businessModuleService"

// src/modules/consultation/index.ts  
export const CONSULTATION_MODULE = "consultationModuleService"

// src/modules/financials/index.ts
export const FINANCIALS_MODULE = "financialsModuleService"

// src/modules/compliance/index.ts
export const COMPLIANCE_MODULE = "complianceModuleService"
```

### Resolving Modules

```typescript
// In API routes, jobs, subscribers:
const businessService = req.scope.resolve(BUSINESS_MODULE)
const businessService = container.resolve(BUSINESS_MODULE) // in jobs/subscribers
```

---

## Key Patterns for Documentation Reference

### When to Reference Medusa V2 Docs

| Topic | Medusa Docs Section | Usage in This Codebase |
|-------|--------------------|------------------------|
| Module Creation | `learn/fundamentals/modules` | All 4 custom modules follow this pattern |
| Data Models | `learn/fundamentals/modules#data-models` | Model definitions in `models/*.ts` |
| Services | `learn/fundamentals/modules#services` | `MedusaService` extension pattern |
| Migrations | `learn/fundamentals/modules#migrations` | `npx medusa db:generate <module>` |
| API Routes | `learn/fundamentals/api-routes` | File-based routing in `src/api/` |
| Middleware | `learn/fundamentals/api-routes/middlewares` | `defineMiddlewares()` in `middlewares.ts` |
| Workflows | `learn/fundamentals/workflows` | Step-based business logic |
| Scheduled Jobs | `learn/fundamentals/scheduled-jobs` | Background processing in `src/jobs/` |
| Subscribers | `learn/fundamentals/events-and-subscribers` | Event handlers in `src/subscribers/` |
| Query API | `learn/fundamentals/module-links/query` | Used in workflows for cart validation |

### Medusa V2 vs V1 Patterns (CRITICAL)

| V1 Pattern | V2 Pattern | Used Here |
|------------|-----------|-----------|
| `src/services/*.ts` | `src/modules/<name>/service.ts` | ✅ Yes |
| `router.use()` | `src/api/**/route.ts` files | ✅ Yes |
| `api/routes/*` | `src/api/admin/*`, `src/api/store/*` | ✅ Yes |
| Services with custom methods | `MedusaService` + custom methods | ✅ Yes |
| No workflows | Workflows for business logic | ✅ Yes |

### Custom Patterns Not in Medusa Docs

| Pattern | Location | Purpose |
|---------|----------|---------|
| PHI Encryption | `src/utils/encryption.ts` | HIPAA-compliant field encryption |
| Tenant Resolution | `src/api/middlewares/tenant-resolution.ts` | Multi-tenant business lookup |
| Consult Gating | `src/api/middlewares/consult-gating.ts` | Prescription product enforcement |
| Audit Logging | `src/api/middlewares/audit-logging.ts` | HIPAA audit trails |
| Rate Limiting | `src/api/middlewares/rate-limiter.ts` | Auth endpoint protection |
| Consult Approvals | `BusinessModuleService` | Customer→product permission system |
| Earnings Calculation | `FinancialsService` | Complex fee distribution |

---

## Quick Reference: Adding New Features

### Adding a New Module

1. Create `src/modules/<name>/models/*.ts` with model definitions
2. Create `src/modules/<name>/service.ts` extending `MedusaService`
3. Create `src/modules/<name>/index.ts` exporting `Module()`
4. Register in `medusa-config.ts`
5. Run `npx medusa db:generate <module>` and `npx medusa db:migrate`

### Adding a New API Route

1. Create `src/api/<scope>/<path>/route.ts` (scope: `admin` or `store`)
2. Export `GET`, `POST`, `PUT`, `DELETE`, `PATCH` handlers
3. Resolve modules via `req.scope.resolve(MODULE_CONSTANT)`
4. Add middleware in `src/api/middlewares.ts` if needed

### Adding a New Workflow

1. Create `src/workflows/<name>/index.ts`
2. Define steps with `createStep()`
3. Compose workflow with `createWorkflow()`
4. Return `WorkflowResponse`
5. Execute with `await workflow(req.scope).run({ input: {...} })`

### Adding a New Job

1. Create `src/jobs/<name>.ts`
2. Export default async function with `container` parameter
3. Export `config = { name, schedule: "cron" }`

### Adding a New Subscriber

1. Create `src/subscribers/<name>.ts`
2. Export default async function with `{ event, container }` destructuring
3. Export `config: SubscriberConfig = { event: "event.name" }`

---

## Environment Variables Reference

| Variable | Purpose | Used In |
|----------|---------|---------|
| `PHI_ENCRYPTION_ENABLED` | Enable PHI field encryption | BusinessModule, ConsultationModule |
| `TENANT_PLATFORM_BASE_DOMAIN` | Platform domain for tenant resolution | tenant-resolution middleware |
| `PLATFORM_HOSTNAMES` | Hostnames that aren't tenants | tenant-resolution middleware |
| `PAYOUT_SIM_FAILURE_RATE` | Chaos testing for payouts | process-payouts job |
| `DOCUMENT_STORAGE_PROVIDER` | s3/gcs/azure/local | ComplianceModule |
| `DOCUMENT_ENCRYPTION_KEY_ID` | Document encryption | ComplianceModule |
