# Architecture - TheRxSpot Marketplace

**White-Label Telehealth Platform on Medusa.js**

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Customer Storefronts                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │patients.rx1  │  │patients.rx2  │  │patients.rx3  │      │
│  │.com          │  │.com          │  │.com          │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Next.js Storefront (Multi-Tenant)              │
│                   - Tenant resolution                        │
│                   - Dynamic branding                         │
│                   - Consult-gating                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ API Requests
┌─────────────────────────────────────────────────────────────┐
│                     Medusa Backend                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Middleware Stack                                      │  │
│  │  - Tenant Resolution                                   │  │
│  │  - Rate Limiting                                       │  │
│  │  - Auth                                                │  │
│  │  - Tenant Isolation                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  API Routes                                            │  │
│  │  - Admin: /admin/*                                     │  │
│  │  - Store: /store/*                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Custom Modules                                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │  │
│  │  │Business  │ │Consult   │ │Financial │ │Compli   │ │  │
│  │  │Module    │ │Module    │ │Module    │ │ance     │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Medusa Core                                           │  │
│  │  - Products, Orders, Cart, Customers, Payments         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │PostgreSQL│  │  Redis   │  │   S3     │  │  Stripe  │   │
│  │(Primary) │  │ (Cache)  │  │(Documents│  │(Payments)│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenancy Architecture

### Tenant Resolution

**Method:** Domain-based routing

```
Request: https://patients.therxspot.com/business/y9ak5uxn/rpcx28i2
                    │                              │          │
                    │                              │          └─ Location ID
                    │                              └─ Business ID
                    └─ Platform subdomain

Middleware resolves:
1. Extract business_id from URL path
2. Load Business record from database
3. Attach to request context
4. Load branding configuration
5. Set sales channel for product filtering
```

### Catalog Isolation

**Using Medusa Sales Channels:**

```
Business 1 (TheRxSpot)
  └─ Sales Channel: "therxspot-channel"
      └─ Products: Tirzepatide, Semaglutide

Business 2 (OtherBusiness)
  └─ Sales Channel: "otherbusiness-channel"
      └─ Products: Different catalog

Store API Request:
  - Include publishable_api_key (maps to sales channel)
  - Medusa automatically filters products to that channel
```

---

## Data Models

### Custom Modules

#### 1. Business Module

**Business**
```typescript
{
  id: string
  name: string              // "The Rx Spot"
  slug: string              // "therxspot"
  phone: string             // "+18888437977"
  email: string
  status: "active" | "inactive"
  tagline: string           // "RXS for Your Success!"
  description: string

  // Address
  street: string
  unit: string
  city: string
  state: string
  zip: string
  country: string

  // Branding
  logo_url: string
  brand_colors: object      // { primary: "#...", secondary: "#..." }

  // Platform fees
  client_service_fee_mode: "fixed" | "percentage"
  client_service_fee_amount: number
  business_commission_rate: number  // Default 5%

  // Custom domain
  domain: string            // "patients.therxspot.com"
  domain_verified: boolean

  // Tracking
  custom_tracking_script: string  // HTML <script> tags

  // Medusa integration
  sales_channel_id: string
  publishable_api_key_id: string

  created_at: Date
  updated_at: Date
}
```

**Location**
```typescript
{
  id: string
  business_id: string
  name: string
  phone: string

  // Address
  street: string
  unit: string
  city: string
  state: string
  zip: string
  country: string

  // Operations
  operation_type: "virtual"
  status: "active" | "inactive"

  // Serviceable states
  serviceable_states: string[]  // ["FL", "NY", "CA"]

  created_at: Date
  updated_at: Date
}
```

**ConsultSubmission**
```typescript
{
  id: string
  business_id: string
  customer_id: string
  product_id: string

  // Submission data
  answers: object           // Eligibility form responses
  mode: "form" | "video" | "audio"

  // Status
  status: "pending" | "approved" | "rejected"
  reviewed_by: string       // User ID
  reviewed_at: Date
  rejection_reason: string

  created_at: Date
}
```

**ConsultApproval**
```typescript
{
  id: string
  customer_id: string
  product_id: string
  business_id: string
  consultation_id: string

  status: "pending" | "approved" | "rejected" | "expired"
  approved_by: string
  approved_at: Date
  expires_at: Date

  created_at: Date
}
```

#### 2. Consultation Module

**Consultation**
```typescript
{
  id: string                // "CO-AQL631"
  business_id: string
  patient_id: string        // Links to customer
  clinician_id: string

  // Consultation details
  mode: "video" | "audio" | "form"
  type: "initial" | "followup"
  status: "scheduled" | "in_progress" | "completed" | "incomplete" | "no_show" | "cancelled"

  // Scheduling
  scheduled_at: Date
  started_at: Date
  ended_at: Date
  duration_minutes: number

  // Clinical data
  chief_complaint: string
  medical_history: object
  assessment: string
  plan: string
  notes: string

  // Outcome
  outcome: "approved" | "rejected" | "needs_followup"
  rejection_reason: string
  approved_medications: string[]

  // Links
  originating_submission_id: string
  order_id: string

  created_at: Date
  updated_at: Date
}
```

**Clinician**
```typescript
{
  id: string
  business_id: string
  user_id: string

  // Personal
  first_name: string
  last_name: string
  email: string
  phone: string

  // License
  npi_number: string
  license_number: string
  license_state: string
  license_expiry: Date

  // Professional
  credentials: string[]     // ["MD", "DO"]
  specializations: string[] // ["Telemedicine", "Weight Loss"]

  // Status
  status: "active" | "inactive"
  is_platform_clinician: boolean
  timezone: string

  created_at: Date
}
```

**ConsultationStatusEvent**
```typescript
{
  id: string
  consultation_id: string

  from_status: string
  to_status: string

  actor_id: string
  actor_type: "clinician" | "admin" | "system"

  notes: string
  metadata: object

  created_at: Date
}
```

#### 3. Financials Module

**EarningEntry**
```typescript
{
  id: string
  business_id: string
  order_id: string
  line_item_id: string
  consultation_id: string

  // Type
  type: "consult_fee" | "medication_fee" | "platform_fee"
  description: string

  // Amounts
  gross_amount: number
  platform_fee: number
  payment_processing_fee: number
  net_amount: number
  clinician_fee: number      // For consult fees only

  // Status
  status: "pending" | "available" | "paid" | "reversed"
  available_at: Date         // When funds become available
  paid_at: Date
  payout_id: string

  metadata: object
  created_at: Date
}
```

**Payout**
```typescript
{
  id: string
  business_id: string

  // Amounts
  total_amount: number       // Sum of earning entries
  fee_amount: number         // Processing fee
  net_amount: number         // Amount actually paid out

  // Status
  status: "pending" | "processing" | "completed" | "failed"

  // Payment
  method: "bank_transfer" | "check" | "paypal"
  destination_account: string

  // Timing
  requested_at: Date
  processed_at: Date
  completed_at: Date

  // External
  transaction_id: string     // Stripe transfer ID
  failure_reason: string

  // Entries
  earning_entries: string[]  // IDs of included earnings

  created_at: Date
}
```

#### 4. Compliance Module

**Document**
```typescript
{
  id: string
  business_id: string
  patient_id: string
  consultation_id: string
  order_id: string
  uploaded_by: string

  // Document info
  type: "prescription" | "id" | "insurance" | "medical_record" | "other"
  title: string
  description: string

  // Storage
  storage_provider: "s3" | "local"
  storage_bucket: string
  storage_key: string
  file_name: string
  file_size: number
  mime_type: string
  checksum: string

  // Security
  encryption_key_id: string
  is_encrypted: boolean
  access_level: "patient_only" | "clinician" | "business_staff" | "platform_admin"

  // Lifecycle
  expires_at: Date
  download_count: number
  last_downloaded_at: Date
  last_downloaded_by: string

  created_at: Date
}
```

**AuditLog**
```typescript
{
  id: string

  // Actor
  actor_type: "user" | "admin" | "system"
  actor_id: string
  actor_email: string
  ip_address: string
  user_agent: string

  // Action
  action: "create" | "read" | "update" | "delete" | "download"
  entity_type: "document" | "consultation" | "patient" | "order"
  entity_id: string

  // Context
  business_id: string
  consultation_id: string
  order_id: string

  // Details
  changes: object           // Before/after for updates
  metadata: object

  // Classification
  risk_level: "low" | "medium" | "high" | "critical"
  flagged: boolean

  created_at: Date
}
```

### Medusa Native Models

**Product** (Medusa native)
- Standard product entity
- Metadata: `requires_consult`, `consult_fee`, `type`

**Product Variant** (Medusa native)
- Dosages (e.g., "25mg", "50mg")

**Order** (Medusa native)
- Standard order entity
- Metadata: `consultation_id`, `consult_status`

**Customer** (Medusa native)
- Patient accounts
- Links to Patient model in consultation module

---

## API Architecture

### Middleware Stack

Order of execution:

1. **CORS & Security Headers**
2. **Tenant Resolution** - Extract business context
3. **Authentication** - Verify JWT or API key
4. **Rate Limiting** - Redis-based rate limits
5. **Tenant Isolation** - Enforce business_id scoping
6. **Audit Logging** - Log PHI access
7. **Route Handler** - Execute business logic

### API Routes

#### Admin Routes (`/admin`)

```
/admin/businesses
  GET    - List businesses
  POST   - Create business

/admin/businesses/:id
  GET    - Get business details
  PUT    - Update business
  DELETE - Delete business

/admin/businesses/:id/provision
  POST   - Provision sales channel & API key

/admin/businesses/:id/domains
  POST   - Add custom domain
  GET    - List domains

/admin/consultations
  GET    - List consultations (all businesses)

/admin/consultations/:id
  GET    - Get consultation details
  PUT    - Update consultation

/admin/consultations/:id/assign
  POST   - Assign clinician

/admin/orders
  GET    - List orders (all businesses)

/admin/earnings
  GET    - List earnings

/admin/earnings/summary
  GET    - Earnings summary (totals, pending, available)

/admin/payouts
  GET    - List payouts
  POST   - Create payout request

/admin/documents
  POST   - Upload document
  GET    - List documents

/admin/documents/:id
  GET    - Get document metadata
  DELETE - Delete document

/admin/documents/:id/download
  GET    - Download document (presigned URL)
```

#### Store Routes (`/store`)

```
/store/businesses
  GET    - List businesses (public)

/store/businesses/:slug
  GET    - Get business by slug

/store/businesses/:slug/locations
  GET    - List locations

/store/businesses/:slug/consult
  POST   - Submit consultation form

/store/product-categories
  GET    - List categories

/store/carts
  POST   - Create cart
  GET    - Get cart
  POST   - Add item to cart (with consult-gating)

/store/consultations
  GET    - List customer's consultations
  POST   - Create consultation

/store/consultations/:id
  GET    - Get consultation details

/store/consultations/:id/cancel
  POST   - Cancel consultation

/store/documents/:id/download
  GET    - Download customer's document
```

---

## Workflows

### Business Provisioning

```typescript
// src/workflows/provision-business.ts

Input: { business_id: string }

Steps:
1. Create Sales Channel
   - Name: "{business.name} Channel"
   - Description: "Sales channel for {business.name}"

2. Link Sales Channel to Business
   - Update business.sales_channel_id

3. Create Publishable API Key
   - Name: "{business.name} API Key"
   - Restrict to sales channel

4. Link API Key to Business
   - Update business.publishable_api_key_id

5. Return provisioned business

Output: { business, sales_channel, api_key }
```

### Consult-Gating (Cart Addition)

```typescript
// src/workflows/consult-gating/index.ts

Input: { cart_id, product_id, variant_id }

Steps:
1. Get Product Metadata
   - Check: product.metadata.requires_consult

2. If requires_consult:
   a. Check for valid ConsultApproval
      - customer_id matches cart.customer_id
      - product_id matches
      - status = "approved"
      - NOT expired

   b. If no valid approval:
      - Return error: CONSULT_REQUIRED
      - Include consult_fee from metadata

3. If approved or not required:
   - Add item to cart normally

4. Return cart

Output: { cart } or { error: "CONSULT_REQUIRED" }
```

### Order Lifecycle

```typescript
// src/workflows/order-lifecycle/index.ts

Statuses:
- pending → Payment received
- consult_pending → Waiting for consultation approval
- consult_complete → Consultation approved
- consult_rejected → Consultation rejected
- in_production → Being prepared
- shipped → En route
- delivered → Successfully delivered
- cancelled → Order cancelled

State Transitions:
pending → consult_pending (if has consult-required items)
consult_pending → consult_complete (on consultation approval)
consult_pending → consult_rejected (on consultation rejection)
consult_complete → in_production
in_production → shipped
shipped → delivered
```

---

## Background Jobs

### Domain Verification

**Schedule:** Every 5 minutes

```typescript
// src/jobs/domain-verification.ts

1. Find businesses where domain_verified = false
2. For each business:
   a. Query DNS for TXT record
   b. Validate TXT record matches expected value
   c. If valid:
      - Set business.domain_verified = true
      - Trigger domain activation workflow
   d. If invalid after 7 days:
      - Send notification to business owner
```

### Process Payouts

**Schedule:** Daily at 2:00 AM

```typescript
// src/jobs/process-payouts.ts

1. Find payouts with status = "pending"
2. For each payout:
   a. Verify business has valid bank account
   b. Create Stripe transfer
   c. Update payout status to "processing"
   d. On success:
      - Update payout status to "completed"
      - Mark earning entries as "paid"
   e. On failure:
      - Update payout status to "failed"
      - Store failure_reason
      - Send notification
```

---

## Security Architecture

### Authentication

- **Admin**: JWT tokens (Medusa Auth)
- **Customers**: Session cookies
- **API**: Publishable API keys (per sales channel)

### Authorization

- **Tenant Isolation**: Middleware enforces `business_id` filtering
- **RBAC**: BusinessUser table with role field
- **API Keys**: Scoped to sales channels

### Data Protection

- **Encryption at Rest**: Documents encrypted in S3
- **Encryption in Transit**: TLS 1.3
- **PHI Access Logging**: All document/consultation access logged
- **Auto-Logoff**: 15-minute inactivity timeout

### Rate Limiting

- **Redis-based**: Distributed, scales horizontally
- **Per-Endpoint**: Different limits for auth, consult, API

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Load Balancer                          │
└─────────────────────────────────────────────────────────┘
              │                            │
              ▼                            ▼
┌───────────────────────┐    ┌───────────────────────┐
│  Medusa Backend       │    │  Next.js Storefront   │
│  (Docker containers)  │    │  (Vercel/AWS)         │
│  - 2+ instances       │    │  - Edge deployment    │
└───────────────────────┘    └───────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL (RDS)                            │
│              - Primary + Replica                         │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│              Redis (ElastiCache)                         │
│              - Rate limiting, caching                    │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend Framework | Medusa.js 2.13.1 | Headless commerce |
| Language | TypeScript | Type safety |
| Database | PostgreSQL 15 | Primary data store |
| Cache | Redis | Rate limiting, sessions |
| Storage | AWS S3 | Document storage |
| Payment | Stripe | Payment processing |
| Email | SendGrid | Notifications |
| Virus Scanning | ClamAV | File upload security |
| Frontend | Next.js 15 | Storefront |
| Styling | Tailwind CSS | UI components |
| Testing | Jest | Unit & integration |
| Container | Docker | Deployment |

---

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for development roadmap.
