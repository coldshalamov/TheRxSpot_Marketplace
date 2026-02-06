# Authentication & Security

> **CRITICAL**: This is a HIPAA-compliant healthcare marketplace. ALL access to PHI (Protected Health Information) must be logged, encrypted, and authorized.

## TL;DR

- **Authentication**: JWT-based with custom actor types (`business_admin`, `customer`, `clinician`)
- **3 User Types**: 
  - Super Admin (platform operations)
  - Business Admin (tenant-scoped access to their business data)
  - Patient (customer-facing, consultation-gated purchases)
- **Session Security**: 15-minute auto-logoff for HIPAA compliance
- **PHI Protection**: AES-256-GCM encryption at rest, audit logging for all access
- **Tenant Isolation**: All queries must be scoped by `business_id`

### HIPAA Requirements Checklist

| Requirement | Implementation | Location |
|-------------|----------------|----------|
| Access Controls | Role-based + tenant isolation | `tenant-isolation.ts`, `access-control.ts` |
| Audit Logging | All PHI access logged | `audit-logging.ts`, `compliance` module |
| Auto-Logoff | 15-minute inactivity timeout | `auto-logoff.ts` |
| PHI Encryption | AES-256-GCM field-level encryption | `encryption.ts` |
| Transmission Security | HTTPS + secure cookies | `medusa-config.ts` |
| Integrity Controls | Checksums on documents | `compliance/utils/checksum.ts` |

---

## Authentication Architecture

### JWT-Based Auth Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client    │────▶│  /auth/login │────▶│  Auth Provider  │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  API Access │◀────│  JWT Token   │◀────│  Session/Cookie │
└─────────────┘     └──────────────┘     └─────────────────┘
```

**Configuration** (`medusa-config.ts`):
```typescript
module.exports = defineConfig({
  projectConfig: {
    http: {
      jwtSecret: process.env.JWT_SECRET!,      // Min 64 chars
      cookieSecret: process.env.COOKIE_SECRET!,
      authCors: process.env.AUTH_CORS!,
    },
    cookieOptions: {
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  },
})
```

**Environment Requirements** (`.env`):
```bash
# Secrets - MUST be at least 64 characters in production
JWT_SECRET=your-super-secret-jwt-key-min-64-characters-long
COOKIE_SECRET=your-super-secret-cookie-key-min-64-characters

# CORS
STORE_CORS=http://localhost:8000
ADMIN_CORS=http://localhost:7000,http://localhost:7001
AUTH_CORS=http://localhost:7000,http://localhost:8000

# PHI Encryption (required in production)
PHI_ENCRYPTION_ENABLED=true
ENCRYPTION_KEY_CURRENT=your-32-byte-hex-key-64-characters-long
```

### Custom Actor Types

Medusa V2 supports custom actor types for multi-tenant scenarios:

```typescript
// src/api/middlewares.ts
import { defineMiddlewares, authenticate } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/tenant/*",
      middlewares: [authenticate("user", ["session", "bearer"])],
    },
    {
      matcher: "/store/customer/*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/clinician*",
      middlewares: [authenticate("clinician", ["session", "bearer"])],
    },
  ],
})
```

**Accessing Auth Context in Routes**:
```typescript
import { AuthenticatedMedusaRequest } from "@medusajs/framework/http"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const userId = req.auth_context?.actor_id      // User ID
  const actorType = req.auth_context?.actor_type // "user", "customer", "clinician"
  const authIdentityId = req.auth_context?.auth_identity_id
  
  // Use for tenant isolation
  const businessId = req.auth_context?.metadata?.business_id
}
```

### Session Management

**Auto-Logoff Middleware** (`src/api/middlewares/auto-logoff.ts`):
- Implements HIPAA-001: 15-minute inactivity timeout
- Tracks `lastActivity` timestamp in session
- Logs timeout events for audit compliance
- Configurable timeouts for different roles

```typescript
// Default: 15 minutes (HIPAA compliant)
export const autoLogoffMiddleware = createAutoLogoffMiddleware(15)

// Factory for different timeouts
autoLogoffMiddlewareFactory.standard()  // 15 min
autoLogoffMiddlewareFactory.strict()    // 5 min (admin, clinicians)
autoLogoffMiddlewareFactory.extended()  // 30 min (kiosks - requires documentation)
autoLogoffMiddlewareFactory.custom(45)  // Custom timeout
```

---

## Authorization Patterns

### Tenant Isolation (business_id Scoping)

**CRITICAL**: Every query for tenant-scoped data MUST include `business_id` filter.

```typescript
// WRONG - Returns data from all tenants
const { data } = await query.graph({
  entity: "patient",
  fields: ["*"],
})

// CORRECT - Scoped to tenant
const tenantContext = (req as any).tenant_context
const { data } = await query.graph({
  entity: "patient",
  fields: ["*"],
  filters: { business_id: tenantContext.business_id },
})
```

**Tenant Context Extraction**:
```typescript
// Use the helper from tenant-isolation.ts
import { ensureTenantContext } from "../../middlewares/tenant-isolation"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = ensureTenantContext(req, res)
  if (!tenantContext) return  // Response already sent
  
  // Now safe to use tenantContext.business_id
}
```

### Role-Based Access (Middleware)

**Tenant Admin Auth Middleware** (`src/api/middlewares/tenant-admin-auth.ts`):

```typescript
export const tenantAdminAuthMiddleware = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const authIdentityId = (req as any).auth_context?.auth_identity_id
  
  if (!authIdentityId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  // Look up BusinessUser by auth_identity_id
  const businessUsers = await businessModuleService.listBusinessUsers(
    { auth_identity_id: authIdentityId, is_active: true },
    { take: 1 }
  )

  if (!businessUsers.length) {
    return res.status(403).json({ message: "No tenant access" })
  }

  // Attach tenant context
  ;(req as any).tenant_context = {
    business_id: businessUser.business_id,
    business_user: businessUser,
  }
  
  next()
}
```

### Resource-Level Permissions

**Document Access Control** (`src/modules/compliance/utils/access-control.ts`):

```typescript
import { 
  canAccessDocument, 
  canDownloadDocument,
  canModifyDocument,
  DocumentAccessLevel 
} from "../../modules/compliance/utils/access-control"

// Check access
const allowed = canAccessDocument(
  document,
  userId,
  userType,  // "patient" | "clinician" | "business_staff" | "platform_admin"
  isOwner
)

// Access levels
const accessLevels: DocumentAccessLevel[] = [
  "patient_only",    // Only the patient
  "clinician",       // Patient + clinicians
  "business_staff",  // Patient + clinicians + business staff
  "platform_admin",  // Full access
]
```

---

## HIPAA Compliance

### PHI Encryption (At Rest)

**Field-Level Encryption** (`src/utils/encryption.ts`):

```typescript
import { 
  encryptString, 
  decryptString,
  encryptField,
  decryptField,
  encryptFields,
  decryptFields 
} from "../../utils/encryption"

// Encrypt single value
const encrypted = encryptString("sensitive data")
// Format: v1:<ivHex>:<tagHex>:<ciphertextHex>

// Decrypt
const decrypted = decryptString(encrypted)

// Encrypt/decrypt fields in objects
const patientData = {
  first_name: "John",
  last_name: "Doe",
  ssn: "123-45-6789",
}

const encrypted = encryptFields(patientData, ["first_name", "last_name", "ssn"])
const decrypted = decryptFields(encrypted, ["first_name", "last_name", "ssn"])
```

**PHI Fields Requiring Encryption** (from `src/modules/consultation/models/patient.ts`):
- `first_name`
- `last_name`
- `email`
- `phone`
- `emergency_contact_name`
- `emergency_contact_phone`
- `date_of_birth` (as text)
- `medical_history` (JSON-stringified & encrypted)
- `allergies` (JSON-stringified & encrypted)
- `medications` (JSON-stringified & encrypted)

### Audit Logging (All Access)

**Automatic Audit Logging** (`src/api/middlewares/audit-logging.ts`):

All PHI access is automatically logged. Configure in `src/api/middlewares.ts`:

```typescript
{
  matcher: "/admin/consultations*",
  middlewares: [auditLoggingMiddleware],
},
{
  matcher: "/admin/patients*",
  middlewares: [auditLoggingMiddleware],
},
{
  matcher: "/admin/documents*",
  middlewares: [documentAuditMiddleware],
},
```

**Manual Audit Logging**:
```typescript
import { logAuditEvent } from "../../middlewares/audit-logging"

await logAuditEvent(req, {
  action: "read",           // create | read | update | delete | download | login | logout | export
  entityType: "patient",    // consultation | order | document | patient | business | earning | payout
  entityId: patient.id,
  businessId: tenantContext.business_id,
  consultationId: consultationId,
  riskLevel: "high",        // low | medium | high | critical
  metadata: { 
    reason: "clinical_review",
    accessed_by: "clinician",
  },
})
```

**Audit Log Schema** (`src/modules/compliance/models/audit-log.ts`):
```typescript
{
  actor_type: "customer" | "business_user" | "clinician" | "system" | "api_key"
  actor_id: string
  actor_email: string?
  ip_address: string?
  user_agent: string?
  action: "create" | "read" | "update" | "delete" | "download" | "login" | "logout" | "export"
  entity_type: "consultation" | "order" | "document" | "patient" | "business" | "earning" | "payout"
  entity_id: string
  business_id: string?
  consultation_id: string?
  order_id: string?
  changes: JSON?           // Before/after for updates
  metadata: JSON?
  risk_level: "low" | "medium" | "high" | "critical"
  flagged: boolean         // Auto-flagged for high/critical risk
}
```

### Auto-Logoff (Inactive Sessions)

See [Session Management](#session-management) above.

### Data Retention

Implement retention policies via scheduled jobs:

```typescript
// src/jobs/data-retention.ts
export default async function dataRetentionJob(container: MedusaContainer) {
  const complianceService = container.resolve("complianceModuleService")
  
  // Archive audit logs older than 7 years
  await complianceService.archiveOldAuditLogs({
    olderThanDays: 2555,  // 7 years
    archiveTo: "s3",
  })
  
  // Soft-delete expired documents
  await complianceService.deleteExpiredDocuments()
}

export const config = {
  name: "data-retention",
  schedule: "0 0 * * *",  // Daily at midnight
}
```

---

## Security Middleware

### tenant-admin-auth.ts

**Purpose**: Authenticates business admin users and attaches tenant context.

**Usage**:
```typescript
// src/api/middlewares.ts
{
  matcher: "/admin/tenant/*",
  middlewares: [tenantAdminAuthMiddleware],
}
```

**Attaches to Request**:
```typescript
req.tenant_context = {
  business_id: string,
  business_user: BusinessUser,
}
```

### tenant-isolation.ts

**Purpose**: Validates tenant access and prevents cross-tenant data access.

**Key Functions**:
```typescript
// Extract and validate tenant context
requireTenantContext()           // Middleware factory
ensureTenantContext(req, res)     // Route helper - returns null if invalid
verifyTenantAccess(req, resourceType, resourceBusinessId)  // Resource check
```

**Security Events Logged**:
- `UNAUTHORIZED_ACCESS_ATTEMPT`
- `CROSS_TENANT_ACCESS_ATTEMPT`
- `RESOURCE_ENUMERATION_ATTEMPT`
- `PRIVILEGE_ESCALATION_ATTEMPT`

### auto-logoff.ts

**Purpose**: HIPAA-001 compliance - automatic session timeout after inactivity.

**Features**:
- 15-minute default timeout
- Session activity tracking
- Audit logging of timeout events
- Configurable per-role timeouts

### audit-logging.ts

**Purpose**: HIPAA compliance - log all PHI access.

**Features**:
- Automatic URL parameter redaction (HIPAA-008)
- Risk level assessment
- IP address and user agent tracking
- Flagging of high-risk events

**Sensitive Parameters Redacted**:
```typescript
const SENSITIVE_PARAMS = [
  "patient_id", "consultation_id", "customer_id",
  "email", "phone", "ssn", "dob", "mrn",
  "insurance_id", "prescription_id",
  "password", "token",
]
```

### Rate Limiting (rate-limiter.ts)

**Purpose**: Prevent abuse on sensitive endpoints.

**Pre-configured Limiters**:
```typescript
authRateLimiter              // 5 attempts per 15 min
consultSubmissionRateLimiter // 3 per hour
registrationRateLimiter      // 3 per hour
passwordResetRateLimiter     // 3 per hour
apiRateLimiter               // 100 per 15 min
```

**Usage**:
```typescript
{
  matcher: "/auth/*",
  middlewares: [authRateLimiter],
},
```

### consult-gating.ts

**Purpose**: Prevents purchase of prescription products without consultation.

**Coverage**:
- POST /store/carts (creation with pre-populated items)
- POST /store/carts/:id/line-items
- POST /store/carts/:id/line-items/batch
- POST /store/carts/:id/items
- POST/PUT /store/carts/:id

---

## Patterns

### Pattern: Protected Route

```typescript
// src/api/admin/businesses/route.ts
import { 
  AuthenticatedMedusaRequest, 
  MedusaResponse 
} from "@medusajs/framework/http"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  // Authentication is enforced by middleware
  const userId = req.auth_context?.actor_id
  
  // ... handle request
}
```

### Pattern: Tenant-Scoped Query

```typescript
import { ensureTenantContext } from "../../middlewares/tenant-isolation"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = ensureTenantContext(req, res)
  if (!tenantContext) return
  
  const query = req.scope.resolve("query")
  const { data } = await query.graph({
    entity: "patient",
    fields: ["*"],
    filters: {
      business_id: tenantContext.business_id,  // REQUIRED
    },
  })
  
  res.json({ patients: data })
}
```

### Pattern: PHI Field Encryption

```typescript
import { 
  encryptFields, 
  decryptFields 
} from "../../utils/encryption"

const PHI_FIELDS = [
  "first_name", "last_name", "email", "phone",
  "emergency_contact_name", "emergency_contact_phone",
] as const

// In service or workflow step:
async createPatient(input: CreatePatientInput) {
  // Encrypt before storing
  const encrypted = encryptFields(input, PHI_FIELDS)
  
  const patient = await this.create(encrypted)
  
  // Decrypt when returning
  return decryptFields(patient, PHI_FIELDS)
}
```

### Pattern: Audit Log Emission

```typescript
import { logAuditEvent } from "../../middlewares/audit-logging"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = ensureTenantContext(req, res)
  if (!tenantContext) return
  
  // Perform action
  const patient = await createPatient(req.validatedBody)
  
  // Log the action
  await logAuditEvent(req, {
    action: "create",
    entityType: "patient",
    entityId: patient.id,
    businessId: tenantContext.business_id,
    riskLevel: "medium",
    metadata: {
      created_by: tenantContext.user_id,
    },
  })
  
  res.status(201).json({ patient })
}
```

### Pattern: Document Access Check

```typescript
import { checkDocumentAccess } from "../../modules/compliance/utils/access-control"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const document = await documentService.retrieve(id)
  
  const access = checkDocumentAccess(
    document,
    req.auth_context?.actor_id,
    getUserType(req),  // "patient" | "clinician" | "business_staff" | "platform_admin"
    "download"
  )
  
  if (!access.allowed) {
    return res.status(403).json({ 
      message: access.reason || "Access denied" 
    })
  }
  
  // Proceed with download
}
```

---

## Reference

### Security Checklist for New Features

Before deploying any feature handling PHI:

- [ ] **Authentication**: Route protected with appropriate `authenticate()` middleware
- [ ] **Tenant Isolation**: All queries include `business_id` filter
- [ ] **PHI Encryption**: Sensitive fields encrypted using `encryption.ts`
- [ ] **Audit Logging**: All PHI access logged via `audit-logging.ts`
- [ ] **Access Control**: Resource-level permissions checked
- [ ] **Input Validation**: Zod schemas validate all inputs
- [ ] **Rate Limiting**: Sensitive endpoints have rate limiting
- [ ] **Error Handling**: Errors don't leak sensitive information
- [ ] **Session Security**: Auto-logoff applies to new routes

### Common Vulnerabilities to Avoid

| Vulnerability | Prevention | Location |
|--------------|------------|----------|
| IDOR (Insecure Direct Object Reference) | Always verify `business_id` matches tenant | `tenant-isolation.ts` |
| SQL Injection | Use Medusa's Query API, never raw SQL | All queries |
| Mass Assignment | Explicit field allowlists in services | Service layer |
| Information Disclosure | Redact sensitive params in logs | `audit-logging.ts` |
| Session Hijacking | Secure cookies, short timeouts | `medusa-config.ts`, `auto-logoff.ts` |
| CSRF | SameSite cookies, CORS configuration | `medusa-config.ts` |

### Incident Response

**Security Incident Classification**:

| Level | Description | Response Time |
|-------|-------------|---------------|
| Critical | Data breach, unauthorized PHI access | Immediate |
| High | Failed cross-tenant access, privilege escalation | 1 hour |
| Medium | Suspicious login patterns, rate limit triggers | 4 hours |
| Low | Minor policy violations | 24 hours |

**Incident Response Steps**:

1. **Detect**: Monitor audit logs for flagged events
2. **Contain**: Revoke sessions, disable accounts if needed
3. **Investigate**: Query audit logs for scope of breach
4. **Notify**: HIPAA requires breach notification within 60 days
5. **Remediate**: Fix vulnerability, review access controls
6. **Document**: Record incident and response for compliance

**Audit Query Examples**:

```typescript
// Find all access by a suspicious user
const auditLogs = await complianceService.listAuditLogs({
  actor_id: suspiciousUserId,
  start_date: "2026-01-01",
  end_date: "2026-02-01",
})

// Find cross-tenant access attempts
const violations = await complianceService.listAuditLogs({
  flagged: true,
  risk_level: "high",
})

// Find document downloads for a patient
const downloads = await complianceService.listAuditLogs({
  entity_type: "document",
  action: "download",
  patient_id: patientId,
})
```

---

## Related Documentation

- [Medusa V2 Auth Documentation](https://docs.medusajs.com/resources/commerce-modules/auth)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [Encryption Utility](../src/utils/encryption.ts)
- [Audit Logging Middleware](../src/api/middlewares/audit-logging.ts)
- [Tenant Isolation](../src/api/middlewares/tenant-isolation.ts)
