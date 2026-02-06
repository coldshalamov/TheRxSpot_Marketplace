# TheRxSpot Architecture - Design Decisions & Patterns

> **Purpose**: Understand WHY the system is built this way, not just WHAT exists.

---

## Core Design Principles

### 1. Module-Based Multi-Tenancy

**Decision**: Each tenant (Business) is a module entity, not a Medusa-native concept.

**Why**:
- Medusa doesn't have native multi-tenancy
- Module isolation prevents accidental cross-tenant data leaks
- Easier to reason about: "Business module owns tenant data"

**Pattern**:
```
┌─────────────────────────────────────────┐
│        Medusa Core (unmodified)         │
│  Product, Order, Customer, Cart, etc.   │
└──────────────┬──────────────────────────┘
               │ Links (pivot tables)
┌──────────────▼──────────────────────────┐
│     Custom Modules (tenant-scoped)      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Business │ │Clinician│ │ Earning │   │
│  │ Location│ │ Patient │ │ Payout  │   │
│  │ Domain  │ │Consult  │ │ AuditLog│   │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
```

**Implication**: Core Medusa entities (Product, Order) are "linked" to tenants via module links, not direct database relations.

---

### 2. Tenant Isolation Strategy

**Decision**: Business_id scoping in queries, not separate databases/schemas.

**Why**:
- Simpler operations (one database)
- Medusa's Query API works naturally
- Easier to query across tenants (for super admin)

**Pattern**:
```typescript
// Always filter by business_id
const orders = await orderService.list({
  business_id: currentBusinessId,  // ← Never omit this
})
```

**Enforcement**:
- Middleware sets business context from JWT
- Query hooks auto-scope (where possible)
- Manual queries must include business_id filter

---

### 3. HIPAA Compliance by Design

**Decision**: Encryption, audit logging, and auto-logoff are mandatory, not optional.

**Pattern**:
```
PHI Fields → Encrypted at rest
All API calls → Logged with before/after
Inactive sessions → Auto-terminated (30 min)
Document access → Permission-checked + logged
```

**Implementation**:
- `PHI_ENCRYPTION_ENABLED` env var controls encryption
- `complianceModuleService` handles encryption/decryption transparently
- `audit-logging.ts` middleware captures all changes
- `auto-logoff.ts` middleware tracks session activity

---

### 4. Workflow-Centric Business Logic

**Decision**: Complex operations are workflows, not service methods.

**Why**:
- Compensation (rollback) on failure
- Long-running processes (async)
- Observable execution history
- Retry logic built-in

**Pattern**:
```
Simple CRUD → Service method directly
Complex multi-step → Workflow
Background processing → Scheduled job or subscriber
```

**Examples**:
- `provision-business` workflow - Multi-step tenant onboarding
- `consult-gating` workflow - Prescription validation
- `order-lifecycle` workflow - Custom order state management

---

### 5. Event-Driven Integration

**Decision**: Loose coupling via events, not direct service calls.

**Pattern**:
```
Service A emits → Event Bus → Subscriber B handles
```

**Benefits**:
- Audit logging subscribes to ALL events
- Financial calculations triggered by order events
- Consultation completion triggers earnings calculation

---

## Key Trade-offs

### Trade-off 1: Custom Domains vs. Path-based Routing

**Decision**: Support custom domains (pharmacy.com vs platform.com/pharmacy)

**Cost**: Complex domain verification, SSL management
**Benefit**: White-label appearance for businesses

**Implementation**: `BusinessDomain` model with DNS verification workflow

### Trade-off 2: Workflow Engine vs. Direct DB

**Decision**: Use Medusa workflows even for simple operations

**Cost**: More boilerplate, learning curve
**Benefit**: Consistent patterns, built-in retries/compensation

### Trade-off 3: Module Per Domain vs. Big Module

**Decision**: 4 modules (business, consultation, financials, compliance)

**Could have been**: 1 big "marketplace" module
**Why split**: Clear boundaries, separate deployment possible, team ownership

---

## Data Flow Examples

### Patient Places Order (Happy Path)

```
1. Patient submits consult form
   ↓
2. [Job] process-consult-submission → Validate, encrypt PHI
   ↓
3. Clinician reviews, approves consultation
   ↓
4. [Subscriber] consultation-approved → Patient can now order
   ↓
5. Patient adds to cart, checks out
   ↓
6. [Workflow] consult-gating → Verify consultation approval exists
   ↓
7. [Workflow] order-lifecycle → Custom order state transitions
   ↓
8. [Subscriber] order-placed → Calculate earnings, create audit log
```

### New Business Onboarding

```
1. Super admin triggers provision
   ↓
2. [Workflow] provision-business
   a. Create business record
   b. Create default location
   c. Create sales channel
   d. Link business to sales channel
   e. Create default template config
   f. (Compensation: rollback all on failure)
   ↓
3. [Subscriber] business-created → Send welcome email
```

---

## Anti-Patterns to Avoid

### ❌ Direct Core Model Modification
```typescript
// DON'T: Modify Medusa core entities directly
const order = await orderService.retrieve(orderId)
order.business_id = businessId  // Medusa Order doesn't have this!
await orderService.update(orderId, order)

// DO: Use module links
const link = await remoteLink.create({
  businessModuleService: { business_id: businessId },
  orderModule: { order_id: orderId },
})
```

### ❌ Cross-Module Direct Service Calls
```typescript
// DON'T: Direct coupling
const businessService = container.resolve("businessModuleService")
const consultService = container.resolve("consultationModuleService")
const business = await businessService.retrieve(businessId)
await consultService.doSomethingWithBusiness(business)  // Tight coupling

// DO: Use events or Query API
const query = container.resolve("query")
const { data } = await query.graph({
  entity: "business",
  fields: ["id", "consultations.*"],
  filters: { id: businessId },
})
```

### ❌ Bypassing Tenant Scoping
```typescript
// DON'T: Get all records without filtering
const allOrders = await orderService.list()  // Security risk!

// DO: Always scope
const orders = await orderService.list({ business_id: currentBusinessId })
```

### ❌ Storing PHI Unencrypted
```typescript
// DON'T: Store PHI in plain text
await repository.save({
  patient_name: "John Doe",  // PHI!
  ssn: "123-45-6789",        // PHI!
})

// DO: Use compliance module encryption
await complianceModuleService.createDocument({
  content: encryptedContent,
  access_control: [...],
})
```

---

## When to Break Patterns

**Emergency fixes**: Skip workflow for direct DB update (with audit log)
**Performance**: Cache frequently-accessed, non-sensitive data
**Complex queries**: Raw SQL acceptable in repositories (with review)

---

## See Also

- [YOUR_CODEBASE.md](./YOUR_CODEBASE.md) - WHAT exists
- [MULTI_TENANT_PATTERNS.md](./MULTI_TENANT_PATTERNS.md) - Medusa's marketplace patterns
- [../02_BUILDING/](../02_BUILDING/) - HOW to implement
