# TheRxSpot Marketplace - AGENT A PLAN (Claude)
## Backend Core, Security & Data Layer
**Parallel Execution Track - Zero Conflict with Agent B (GLM 4.7)**

---

## SCOPE BOUNDARY (CRITICAL - DO NOT CROSS)

**AGENT A OWNS:**
- `D:\GitHub\TheRxSpot_Marketplace\src\` (entire Medusa backend)
- `D:\GitHub\TheRxSpot_Marketplace\medusa-config.ts`
- `D:\GitHub\TheRxSpot_Marketplace\.env` and `.env.template`
- `D:\GitHub\TheRxSpot_Marketplace\docker-compose.yml`
- Database migrations
- All backend API routes

**AGENT A DOES NOT TOUCH:**
- `D:\GitHub\TheRxSpot_Marketplace\TheRxSpot_Marketplace-storefront\` 
- `D:\GitHub\TheRxSpot_Marketplace\tenant-admin\`
- Any frontend UI components

---

## EXECUTIVE SUMMARY

**Mission:** Implement the entire backend infrastructure for a production-ready telehealth marketplace, including security hardening, consultation lifecycle, order workflow, earnings system, and document storage.

**Success Criteria:**
- [ ] Server-side consult gating CANNOT be bypassed via API calls
- [ ] All database migrations are generated and runnable
- [ ] Consultation status machine is fully functional
- [ ] Order workflow integrates with consultations
- [ ] Earnings calculation engine is accurate
- [ ] Document storage is HIPAA-compliant with audit trails
- [ ] All backend tests pass

**Estimated Duration:** 3-4 days of intensive development

---

## PHASE A1: SECURITY & FOUNDATION (Day 1)

### A1.1 CRITICAL: Server-Side Consult Gating
**Priority:** P0 - BLOCKS ALL OTHER WORK
**Files to Modify/Created:**
- `src/modules/business/models/consult-approval.ts` (NEW)
- `src/api/middlewares/consult-gating.ts` (NEW)
- `src/api/store/carts/route.ts` (NEW - extend cart creation)
- `src/workflows/consult-gating/index.ts` (NEW)
- `medusa-config.ts` (MODIFY - add middleware config)

**Implementation Details:**

```typescript
// src/modules/business/models/consult-approval.ts
// Purpose: Track consult approvals per customer per product

interface ConsultApproval {
  id: string
  customer_id: string
  product_id: string
  business_id: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  consultation_id: string | null  // Links to full consultation record
  approved_by: string | null      // Clinician or system
  approved_at: Date | null
  expires_at: Date | null         // 30-day default expiration
  created_at: Date
  updated_at: Date
}
```

**Cart Validation Middleware Logic:**
```typescript
// src/api/middlewares/consult-gating.ts
// BEFORE addToCart:
// 1. Check if product.requires_consult === true
// 2. If yes, verify customer has valid ConsultApproval for this product
// 3. Check approval.status === 'approved' AND approval.expires_at > now()
// 4. If no valid approval, reject with 403 { code: "CONSULT_REQUIRED", product_id: "..." }
```

**Testing Verification:**
```bash
# Should FAIL (403 Forbidden):
curl -X POST http://localhost:9000/store/carts/cart_123/line-items \
  -H "Content-Type: application/json" \
  -d '{"variant_id": "variant_consult_required", "quantity": 1}'

# Should SUCCEED (200 OK):
# Same request with valid consult approval in database
```

**Checkpoint A1.1:** 
- [ ] Create ConsultApproval model
- [ ] Add cart middleware validation
- [ ] Test API bypass attempt fails
- [ ] Test approved consult allows purchase

---

### A1.2 Database Migrations
**Priority:** P0
**Files:**
- `src/modules/business/migrations/` (NEW DIRECTORY)
- `src/modules/business/migrations/Migration20250203Initial.ts` (NEW)

**Commands to Run:**
```bash
# After model changes, generate migrations
npx medusa migration generate
npx medusa db:migrate
```

**Models Requiring Migrations:**
1. `ConsultApproval` (NEW)
2. `Consultation` (NEW - see Phase A2)
3. `Clinician` (NEW - see Phase A2)
4. `Patient` (NEW - see Phase A2)
5. `EarningEntry` (NEW - see Phase A3)
6. `Payout` (NEW - see Phase A3)
7. `Document` (NEW - see Phase A4)
8. `AuditLog` (NEW - see Phase A4)
9. `OrderStatusEvent` (NEW - see Phase A2)

**Checkpoint A1.2:**
- [ ] All migrations generated successfully
- [ ] Migration runs without errors
- [ ] Database schema matches models exactly

---

### A1.3 Security Hardening
**Priority:** P0
**Files:**
- `.env` (MODIFY)
- `.env.template` (MODIFY)
- `medusa-config.ts` (MODIFY)

**Tasks:**
1. **Generate Strong Secrets:**
```powershell
# Run these commands and update .env
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('COOKIE_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

2. **Add Security Headers:**
```typescript
// medusa-config.ts - add to projectConfig
http: {
  compression: { enabled: true },
  cookieOptions: {
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true
  }
}
```

3. **Add Rate Limiting:**
```typescript
// src/api/middlewares/rate-limiter.ts (NEW)
// Apply to auth endpoints and consult submissions
```

**Checkpoint A1.3:**
- [ ] JWT_SECRET is 128+ character random hex
- [ ] COOKIE_SECRET is 128+ character random hex
- [ ] Security headers configured
- [ ] Rate limiting on auth endpoints

---

### A1.4 Jobs & Subscribers Infrastructure
**Priority:** P1
**Files:**
- `src/jobs/process-consult-submission.ts` (NEW)
- `src/jobs/domain-verification.ts` (NEW)
- `src/subscribers/order-placed.ts` (NEW)
- `src/subscribers/consult-submission-created.ts` (NEW)
- `src/subscribers/business-status-changed.ts` (NEW)

**Implementation:**
```typescript
// src/jobs/process-consult-submission.ts
// Purpose: Background processing of new consult submissions
// - Send email notification to business
// - Create notification for tenant admin dashboard
// - Auto-assign to available clinician if configured

// src/subscribers/order-placed.ts
// Purpose: Handle order.placed event
// - Create earnings entries
// - Update business order statistics
// - Send confirmation emails
```

**Checkpoint A1.4:**
- [ ] At least 2 job implementations complete
- [ ] At least 3 subscribers registered
- [ ] Events are being handled correctly

---

## PHASE A2: CONSULTATION LIFECYCLE (Day 1-2)

### A2.1 Core Consultation Models
**Priority:** P0
**Files:**
- `src/modules/consultation/models/consultation.ts` (NEW)
- `src/modules/consultation/models/clinician.ts` (NEW)
- `src/modules/consultation/models/patient.ts` (NEW)
- `src/modules/consultation/models/consultation-status-event.ts` (NEW)
- `src/modules/consultation/service.ts` (NEW)
- `src/modules/consultation/index.ts` (NEW)

**Consultation Model:**
```typescript
interface Consultation {
  id: string
  business_id: string
  patient_id: string
  clinician_id: string | null
  
  // Consultation Type
  mode: 'async_form' | 'video' | 'phone' | 'chat'
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'incomplete' | 'no_show' | 'cancelled'
  
  // Scheduling
  scheduled_at: Date | null
  started_at: Date | null
  ended_at: Date | null
  duration_minutes: number | null
  
  // Medical Content
  chief_complaint: string | null
  medical_history: Record<string, any> | null
  assessment: string | null
  plan: string | null
  notes: string | null
  
  // Outcome
  outcome: 'approved' | 'rejected' | 'pending' | 'requires_followup' | null
  rejection_reason: string | null
  approved_medications: string[] | null  // product IDs
  
  // Links
  originating_submission_id: string | null
  order_id: string | null
  
  created_at: Date
  updated_at: Date
}
```

**Status Machine Transitions:**
```
draft → scheduled → in_progress → completed
                    ↓               ↓
                 cancelled      incomplete
                 no_show

On completed with outcome='approved':
  → Create ConsultApproval for approved_medications
  → Update linked Order status to 'consult_complete'
```

**Checkpoint A2.1:**
- [ ] All consultation models defined
- [ ] Module registered in medusa-config.ts
- [ ] Service layer with CRUD operations

---

### A2.2 Consultation API Routes
**Priority:** P0
**Files:**
- `src/api/admin/consultations/route.ts` (NEW)
- `src/api/admin/consultations/[id]/route.ts` (NEW)
- `src/api/admin/consultations/[id]/status/route.ts` (NEW)
- `src/api/admin/consultations/[id]/assign/route.ts` (NEW)
- `src/api/admin/clinicians/route.ts` (NEW)
- `src/api/store/consultations/route.ts` (NEW)
- `src/api/store/consultations/[id]/route.ts` (NEW)

**Endpoints:**
```
GET    /admin/consultations              # List with filters
GET    /admin/consultations/:id          # Get detail with status history
POST   /admin/consultations              # Create consultation
PUT    /admin/consultations/:id          # Update consultation
POST   /admin/consultations/:id/status   # Transition status
POST   /admin/consultations/:id/assign   # Assign clinician
GET    /admin/clinicians                 # List clinicians
POST   /admin/clinicians                 # Create clinician

GET    /store/consultations              # List patient's consultations
GET    /store/consultations/:id          # Get consultation (patient view)
POST   /store/consultations/:id/cancel   # Patient cancellation
```

**Checkpoint A2.2:**
- [ ] All admin routes functional
- [ ] All store routes functional
- [ ] Status transitions validated

---

### A2.3 Clinician Management
**Priority:** P1
**Files:**
- `src/modules/consultation/models/clinician.ts` (NEW)
- `src/modules/consultation/models/clinician-schedule.ts` (NEW)
- `src/api/admin/clinicians/route.ts` (NEW)
- `src/api/admin/clinicians/[id]/route.ts` (NEW)
- `src/api/admin/clinicians/[id]/availability/route.ts` (NEW)

**Clinician Model:**
```typescript
interface Clinician {
  id: string
  business_id: string | null  // null = platform clinician (multi-tenant)
  user_id: string | null      // Linked to Medusa user if applicable
  
  // Profile
  first_name: string
  last_name: string
  email: string
  phone: string | null
  npi_number: string | null   // National Provider Identifier
  license_number: string
  license_state: string
  license_expiry: Date
  credentials: string[]       // MD, DO, NP, PA, etc.
  
  // Specialization
  specializations: string[]   // Weight loss, men's health, etc.
  
  // Status
  status: 'active' | 'inactive' | 'suspended'
  is_platform_clinician: boolean
  
  // Availability (simplified - detailed in ClinicianSchedule)
  timezone: string
  
  created_at: Date
  updated_at: Date
}
```

**Checkpoint A2.3:**
- [ ] Clinician CRUD complete
- [ ] Availability scheduling implemented
- [ ] License validation in place

---

## PHASE A3: ORDER WORKFLOW & FINANCIALS (Day 2-3)

### A3.1 Order Status Machine
**Priority:** P0
**Files:**
- `src/modules/business/models/order-status-event.ts` (NEW)
- `src/workflows/order-lifecycle/index.ts` (NEW)
- `src/subscribers/order-created.ts` (MODIFY)
- `src/subscribers/consultation-completed.ts` (NEW)

**Order Status Flow:**
```
pending → consult_pending → consult_complete → payment_captured → processing → fulfilled → delivered
                                              ↓
                                        consult_rejected → cancelled/refunded

For non-consult products:
pending → payment_captured → processing → fulfilled → delivered
```

**Status Definitions:**
- `consult_pending`: Order requires consultation, waiting for completion
- `consult_complete`: Consultation approved, ready for fulfillment
- `consult_rejected`: Consultation rejected, order to be cancelled
- `processing`: Being prepared by pharmacy
- `fulfilled`: Shipped or ready for pickup
- `delivered`: Confirmed received by patient

**Checkpoint A3.1:**
- [ ] Order status events tracked
- [ ] Status transitions validated
- [ ] Integration with consultation completion

---

### A3.2 Earnings & Payouts System
**Priority:** P0
**Files:**
- `src/modules/financials/models/earning-entry.ts` (NEW)
- `src/modules/financials/models/payout.ts` (NEW)
- `src/modules/financials/service.ts` (NEW)
- `src/modules/financials/index.ts` (NEW)
- `src/api/admin/earnings/route.ts` (NEW)
- `src/api/admin/payouts/route.ts` (NEW)
- `src/api/admin/tenant/earnings/route.ts` (NEW)
- `src/jobs/process-payouts.ts` (NEW)

**EarningEntry Model:**
```typescript
interface EarningEntry {
  id: string
  business_id: string
  order_id: string
  order_item_id: string | null
  consultation_id: string | null
  
  // Earning Type
  type: 'product_sale' | 'consultation_fee' | 'shipping_fee' | 'platform_fee' | 'clinician_fee'
  
  // Amounts
  gross_amount: number        // Total before splits
  platform_fee: number        // Platform commission
  payment_processing_fee: number
  net_amount: number          // What business receives
  clinician_fee: number | null // If applicable
  
  // Status
  status: 'pending' | 'available' | 'paid' | 'reversed'
  available_at: Date | null   // When funds become available for payout
  paid_at: Date | null
  payout_id: string | null
  
  // References
  description: string
  metadata: Record<string, any>
  
  created_at: Date
  updated_at: Date
}
```

**Payout Model:**
```typescript
interface Payout {
  id: string
  business_id: string
  
  // Amount
  total_amount: number
  fee_amount: number
  net_amount: number
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed'
  
  // Method
  method: 'ach' | 'wire' | 'check' | 'stripe_connect'
  destination_account: string | null
  
  // Timing
  requested_at: Date
  processed_at: Date | null
  completed_at: Date | null
  
  // References
  earning_entries: string[]   // IDs of included earnings
  transaction_id: string | null  // External payment processor ID
  failure_reason: string | null
  
  created_at: Date
  updated_at: Date
}
```

**Earnings Calculation Logic:**
```typescript
// On order.placed event:
// 1. Create earning entries for each line item
// 2. Calculate platform fee (configurable %, default 10%)
// 3. Calculate payment processing fee (Stripe ~2.9% + 30¢)
// 4. Net = Gross - Platform Fee - Processing Fee
// 5. Set available_at = now() + 7 days (hold period)

// On consultation.completed event:
// 1. Create consultation_fee entry
// 2. Split between business and clinician
// 3. Mark as pending until order completes
```

**Checkpoint A3.2:**
- [ ] EarningEntry model created
- [ ] Payout model created
- [ ] Earnings calculated on order.placed
- [ ] Payout job processes available earnings

---

### A3.3 Financial API Routes
**Priority:** P1
**Files:**
- `src/api/admin/earnings/route.ts` (NEW)
- `src/api/admin/earnings/summary/route.ts` (NEW)
- `src/api/admin/payouts/route.ts` (NEW)
- `src/api/admin/payouts/[id]/route.ts` (NEW)
- `src/api/admin/tenant/earnings/route.ts` (NEW)
- `src/api/admin/tenant/payouts/route.ts` (NEW)

**Endpoints:**
```
GET    /admin/earnings?business_id=...&status=...  # List all earnings
GET    /admin/earnings/summary                    # Platform-wide stats
GET    /admin/payouts                             # List payouts
POST   /admin/payouts                             # Create payout
GET    /admin/payouts/:id                         # Get payout detail
POST   /admin/payouts/:id/process                 # Process payout

# Tenant-scoped
GET    /admin/tenant/earnings                     # Business earnings
GET    /admin/tenant/earnings/summary             # Summary stats
GET    /admin/tenant/payouts                      # Business payouts
POST   /admin/tenant/payouts/request              # Request payout
```

**Checkpoint A3.3:**
- [ ] All earnings endpoints functional
- [ ] All payout endpoints functional
- [ ] Summary calculations accurate

---

## PHASE A4: DOCUMENT STORAGE & COMPLIANCE (Day 3-4)

### A4.1 Document Management System
**Priority:** P0
**Files:**
- `src/modules/compliance/models/document.ts` (NEW)
- `src/modules/compliance/service.ts` (NEW)
- `src/api/admin/documents/route.ts` (NEW)
- `src/api/admin/documents/[id]/route.ts` (NEW)
- `src/api/admin/documents/[id]/download/route.ts` (NEW)
- `src/api/store/documents/route.ts` (NEW)

**Document Model:**
```typescript
interface Document {
  id: string
  business_id: string
  patient_id: string
  consultation_id: string | null
  order_id: string | null
  uploaded_by: string
  
  // Document Info
  type: 'prescription' | 'lab_result' | 'medical_record' | 'consent_form' | 'id_verification' | 'insurance_card' | 'other'
  title: string
  description: string | null
  
  // Storage
  storage_provider: 's3' | 'gcs' | 'azure' | 'local'
  storage_bucket: string
  storage_key: string
  file_name: string
  file_size: number
  mime_type: string
  checksum: string  // SHA-256 for integrity
  
  // Security
  encryption_key_id: string | null
  is_encrypted: boolean
  
  // Access Control
  access_level: 'patient_only' | 'clinician' | 'business_staff' | 'platform_admin'
  expires_at: Date | null
  
  // Audit
  download_count: number
  last_downloaded_at: Date | null
  last_downloaded_by: string | null
  
  created_at: Date
  updated_at: Date
}
```

**Document Service:**
```typescript
// Key methods:
- uploadDocument(file, metadata, uploadedBy): Promise<Document>
- getSignedDownloadUrl(documentId, requestedBy, expiresInSeconds): Promise<string>
- deleteDocument(documentId, deletedBy): Promise<void>
- listDocuments(filters): Promise<Document[]>
- verifyDocumentIntegrity(documentId): Promise<boolean>
```

**Checkpoint A4.1:**
- [ ] Document model created
- [ ] Upload functionality working
- [ ] Signed URL generation secure

---

### A4.2 Audit Logging System
**Priority:** P0
**Files:**
- `src/modules/compliance/models/audit-log.ts` (NEW)
- `src/modules/compliance/service.ts` (MODIFY)
- `src/api/middlewares/audit-logging.ts` (NEW)
- `src/api/admin/audit-logs/route.ts` (NEW)

**AuditLog Model:**
```typescript
interface AuditLog {
  id: string
  
  // Actor
  actor_type: 'customer' | 'business_user' | 'clinician' | 'system' | 'api_key'
  actor_id: string
  actor_email: string | null
  ip_address: string | null
  user_agent: string | null
  
  // Action
  action: 'create' | 'read' | 'update' | 'delete' | 'download' | 'login' | 'logout' | 'export'
  entity_type: 'consultation' | 'order' | 'document' | 'patient' | 'business' | 'earning' | 'payout'
  entity_id: string
  
  // Context
  business_id: string | null
  consultation_id: string | null
  order_id: string | null
  
  // Details
  changes: {
    before: Record<string, any> | null
    after: Record<string, any> | null
  } | null
  metadata: Record<string, any>
  
  // Risk
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  flagged: boolean
  
  created_at: Date
}
```

**Auto-Logged Events:**
- All PHI access (patient records, consultations, documents)
- Document downloads
- Status changes to consultations/orders
- Login/logout events
- Earning/payout access
- Admin configuration changes

**Checkpoint A4.2:**
- [ ] AuditLog model created
- [ ] Middleware logs all PHI access
- [ ] Admin can query audit logs

---

### A4.3 S3/Storage Integration
**Priority:** P1
**Files:**
- `src/modules/compliance/services/storage/s3-storage.ts` (NEW)
- `src/modules/compliance/services/storage/local-storage.ts` (NEW)
- `src/modules/compliance/services/storage/index.ts` (NEW)

**Environment Variables:**
```bash
# Add to .env
DOCUMENT_STORAGE_PROVIDER=s3  # or 'local' for development
DOCUMENT_STORAGE_BUCKET=therxspot-documents
DOCUMENT_STORAGE_REGION=us-east-1
DOCUMENT_STORAGE_ENDPOINT=s3.amazonaws.com  # or custom for MinIO
DOCUMENT_STORAGE_ACCESS_KEY=...
DOCUMENT_STORAGE_SECRET_KEY=...
DOCUMENT_ENCRYPTION_KEY_ID=...  # KMS key ID
```

**Storage Interface:**
```typescript
interface StorageProvider {
  upload(key: string, buffer: Buffer, metadata: object): Promise<void>
  download(key: string): Promise<Buffer>
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}
```

**Checkpoint A4.3:**
- [ ] S3 provider implemented
- [ ] Local provider for dev
- [ ] Encryption at rest working

---

## PHASE A5: TESTING & HARDENING (Day 4)

### A5.1 Integration Tests
**Priority:** P0
**Files:**
- `src/tests/integration/consult-gating.test.ts` (NEW)
- `src/tests/integration/consultation-lifecycle.test.ts` (NEW)
- `src/tests/integration/order-workflow.test.ts` (NEW)
- `src/tests/integration/earnings.test.ts` (NEW)

**Critical Test Cases:**

**Consult Gating Tests:**
```typescript
describe('Consult Gating Security', () => {
  it('should REJECT adding consult-required product without approval', async () => {
    // Attempt API bypass
    const response = await fetch('/store/carts/cart_123/line-items', {
      method: 'POST',
      body: JSON.stringify({ variant_id: 'consult_product', quantity: 1 })
    })
    expect(response.status).toBe(403)
    expect(await response.json()).toHaveProperty('code', 'CONSULT_REQUIRED')
  })

  it('should ALLOW adding consult-required product WITH approval', async () => {
    // Create consult approval
    await createConsultApproval(customerId, productId, 'approved')
    
    const response = await fetch('/store/carts/cart_123/line-items', {
      method: 'POST',
      body: JSON.stringify({ variant_id: 'consult_product', quantity: 1 })
    })
    expect(response.status).toBe(200)
  })

  it('should REJECT expired consult approvals', async () => {
    // Create expired approval
    await createConsultApproval(customerId, productId, 'approved', { expiresAt: yesterday })
    
    const response = await fetch('/store/carts/cart_123/line-items', {...})
    expect(response.status).toBe(403)
    expect(await response.json()).toHaveProperty('code', 'CONSULT_EXPIRED')
  })
})
```

**Consultation Lifecycle Tests:**
```typescript
describe('Consultation Lifecycle', () => {
  it('should transition through status machine correctly', async () => {
    const consult = await createConsultation()
    expect(consult.status).toBe('draft')
    
    await scheduleConsultation(consult.id)
    consult = await getConsultation(consult.id)
    expect(consult.status).toBe('scheduled')
    
    await startConsultation(consult.id)
    consult = await getConsultation(consult.id)
    expect(consult.status).toBe('in_progress')
    
    await completeConsultation(consult.id, { outcome: 'approved' })
    consult = await getConsultation(consult.id)
    expect(consult.status).toBe('completed')
    expect(consult.outcome).toBe('approved')
  })

  it('should create consult approval on completion with approval outcome', async () => {
    const consult = await createAndCompleteConsultation({ outcome: 'approved', medications: ['prod_123'] })
    
    const approval = await getConsultApproval(customerId, 'prod_123')
    expect(approval).toBeDefined()
    expect(approval.status).toBe('approved')
  })
})
```

**Earnings Tests:**
```typescript
describe('Earnings Calculation', () => {
  it('should calculate correct platform fee', async () => {
    const order = await createOrder({ total: 100, platformFeePercent: 10 })
    const earnings = await getEarningsForOrder(order.id)
    
    expect(earnings[0].gross_amount).toBe(100)
    expect(earnings[0].platform_fee).toBe(10)
    expect(earnings[0].net_amount).toBe(87.1) // 100 - 10 - 2.9 (Stripe)
  })
})
```

**Checkpoint A5.1:**
- [ ] All critical security tests pass
- [ ] Consultation lifecycle tests pass
- [ ] Order workflow tests pass
- [ ] Earnings calculation tests pass

---

### A5.2 Documentation & API Specs
**Priority:** P1
**Files:**
- `docs/API_REFERENCE.md` (NEW)
- `docs/BACKEND_ARCHITECTURE.md` (NEW)
- `docs/DEPLOYMENT.md` (NEW)

**Contents:**
- OpenAPI spec for all new endpoints
- Architecture diagrams
- Deployment instructions
- Environment variable reference

**Checkpoint A5.2:**
- [ ] API documentation complete
- [ ] Architecture documented
- [ ] Deployment guide written

---

## SUBAGENT EXECUTION STRATEGY

Since Agent A has subagent capabilities, use this parallelization:

### Subagent 1: Security & Consult Gating
**Task:** Implement A1.1, A1.3 (consult gating and security)
**Deliverable:** Working server-side consult enforcement

### Subagent 2: Models & Migrations
**Task:** Implement A1.2, A2.1, A3.2, A4.1, A4.2 (all models)
**Deliverable:** All database models and migrations

### Subagent 3: API Routes
**Task:** Implement A2.2, A3.3, A4.1 (all API routes)
**Deliverable:** All REST endpoints functional

### Subagent 4: Workflows & Jobs
**Task:** Implement A1.4, A3.1, A3.2 (background processing)
**Deliverable:** Event-driven architecture working

### Main Agent (You): Integration & Testing
**Task:** A5.1, A5.2 - Integration testing and final hardening
**Deliverable:** Production-ready backend

---

## DAILY CHECKPOINT SCHEDULE

### End of Day 1
- [ ] Consult gating cannot be bypassed (verified with API test)
- [ ] Strong secrets generated and in .env
- [ ] Consultation model created
- [ ] Database migrations generated

### End of Day 2
- [ ] All consultation API routes functional
- [ ] Status machine working
- [ ] Clinician model created
- [ ] Earnings model created

### End of Day 3
- [ ] Order status machine integrated
- [ ] Earnings calculation working
- [ ] Document model created
- [ ] Payout job functional

### End of Day 4
- [ ] All integration tests pass
- [ ] Security audit complete
- [ ] Documentation written
- [ ] Ready for Agent B integration

---

## CONFLICT RESOLUTION PROTOCOL

If you need to modify files in Agent B's domain:
1. DO NOT modify directly
2. Create a file at `D:\GitHub\TheRxSpot_Marketplace\.agent-a-requests\request-XXX.md`
3. Describe the exact change needed and why
4. Agent B will implement during their cycle

Example request format:
```markdown
# Request from Agent A
**File:** tenant-admin/src/lib/api.ts
**Change Needed:** Add getConsultation(consultationId) function
**Reason:** Tenant admin needs to fetch consultation details
**Suggested Implementation:**
```typescript
export async function getConsultation(id: string): Promise<Consultation | null> {
  const res = await fetch(`${BACKEND_URL}/admin/tenant/consultations/${id}`, {...})
  return res.ok ? res.json() : null
}
```
```

---

## VERIFICATION COMMANDS

Run these at the end of each day:

```bash
# Test consult gating bypass prevention
curl -X POST http://localhost:9000/store/carts/cart_123/line-items \
  -H "Content-Type: application/json" \
  -d '{"variant_id": "VARIANT_THAT_REQUIRES_CONSULT", "quantity": 1}'
# EXPECTED: 403 Forbidden with CONSULT_REQUIRED code

# Run backend tests
npm run test:integration:modules

# Verify migrations
npx medusa db:migrate

# Check all services start
npm run dev
```

---

## FINAL DELIVERABLE CHECKLIST

Before declaring "DONE":

- [ ] **Security:** API bypass attempts fail with 403
- [ ] **Security:** JWT/COOKIE secrets are 128+ chars random
- [ ] **Database:** All migrations run without errors
- [ ] **Consultation:** Full status machine working
- [ ] **Consultation:** Approval creates ConsultApproval record
- [ ] **Order:** Status machine integrated with consultations
- [ ] **Financials:** Earnings calculate correctly
- [ ] **Financials:** Payout job processes available earnings
- [ ] **Documents:** Upload and signed download working
- [ ] **Compliance:** All PHI access is audit logged
- [ ] **Tests:** All integration tests pass
- [ ] **Docs:** API reference complete

---

**AGENT A - BACKEND CORE & SECURITY**
**Status:** READY TO EXECUTE
**Last Updated:** 2026-02-03
**Next Sync Point:** End of Day 1 with Agent B
