# Building API Routes

## TL;DR

Route files export HTTP method handlers. Files under `src/api/admin/*` are protected by default. Files under `src/api/store/*` are public by default.

```typescript
// src/api/admin/businesses/route.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../modules/business"
import { provisionBusinessWorkflow } from "../../../workflows/provision-business"

// GET handler with tenant scoping
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const filters: Record<string, any> = {}
  
  if (req.query.status) {
    filters.status = req.query.status
  }
  
  const businesses = await businessModuleService.listAndCountBusinesses(filters)
  res.json({ businesses: businesses[0], count: businesses[1] })
}

// POST handler with workflow execution
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const body = req.body as Record<string, any>

  // Create business
  const business = await businessModuleService.createBusinesses({
    ...body,
    status: "pending",
  })

  // Provision via workflow (creates Sales Channel, API Key, Stock Location)
  const { result } = await provisionBusinessWorkflow(req.scope).run({
    input: {
      business_id: business.id,
      storefront_base_url: body.storefront_url,
    },
  })

  res.status(201).json({ business: result })
}
```

```typescript
// src/api/admin/businesses/[id]/route.ts - Route with parameters
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve("query")
  
  const { data: [business] } = await query.graph({
    entity: "business",
    fields: ["*"],
    filters: { id },
  }, { throwIfKeyNotFound: true })
  
  res.json({ business })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  await businessModuleService.deleteBusinesses(id)
  res.status(204).send()
}
```

---

## Route Basics

### File Location Conventions

Medusa uses file-based routing. The file path determines the URL:

```
src/api/
├── admin/              # Protected admin routes (/admin/*)
│   ├── businesses/
│   │   ├── route.ts    # GET/POST /admin/businesses
│   │   └── [id]/
│   │       └── route.ts # GET/PUT/DELETE /admin/businesses/:id
│   └── consultations/
│       └── route.ts    # GET/POST /admin/consultations
├── store/              # Public store routes (/store/*)
│   ├── businesses/
│   │   └── route.ts    # GET/POST /store/businesses
│   └── consultations/
│       └── route.ts    # GET/POST /store/consultations
└── middlewares.ts      # Global middleware configuration
```

### Admin vs Store Routes

| Aspect | Admin Routes | Store Routes |
|--------|--------------|--------------|
| URL Prefix | `/admin/*` | `/store/*` |
| Default Auth | Protected (requires admin user) | Public |
| Opt-out | `export const AUTHENTICATE = false` | Use `authenticate()` middleware |
| Use Case | Back-office operations | Customer-facing operations |

**Disable authentication for specific routes:**
```typescript
// src/api/admin/public-status/route.ts
export const AUTHENTICATE = false

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({ status: "operational" })
}
```

### Route Parameters

Use `[param]` syntax for dynamic segments:

```typescript
// src/api/admin/consultations/[id]/route.ts
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params  // Access the :id parameter
  // ...
}

// src/api/store/businesses/[slug]/consult/route.ts
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { slug } = req.params  // Access the :slug parameter
  // ...
}
```

---

## Request Handling

### Request Types

```typescript
import { 
  MedusaRequest,           // Base request type
  MedusaResponse,          // Response type
  AuthenticatedMedusaRequest  // Request with auth context
} from "@medusajs/framework/http"

// Basic route
export const GET = (req: MedusaRequest, res: MedusaResponse) => {
  res.json({ message: "Hello" })
}

// Authenticated route - access user info
export const GET = (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const userId = req.auth_context?.actor_id
  const actorType = req.auth_context?.actor_type  // "user", "customer", etc.
  res.json({ userId })
}
```

### Extracting Data

```typescript
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // Path parameters
  const { id } = req.params
  
  // Query parameters
  const { status, limit, offset } = req.query as Record<string, string>
  
  // Request body (for POST/PUT/PATCH)
  const body = req.body as Record<string, any>
  
  // Tenant context (from tenant-resolution middleware)
  const business = (req as any).context?.business
  const businessId = business?.id
  
  // Auth context
  const authContext = (req as any).auth_context
  const actorId = authContext?.actor_id
  const actorType = authContext?.actor_type
}
```

### Response Patterns

```typescript
// Success responses
res.json({ data })                           // 200 OK with JSON
res.status(201).json({ created: data })      // 201 Created
res.status(204).send()                       // 204 No Content (for DELETE)

// Error responses
res.status(400).json({ 
  message: "Invalid input",
  error: error.message 
})

res.status(401).json({ 
  message: "Unauthorized" 
})

res.status(403).json({ 
  message: "Access denied",
  code: "FORBIDDEN"
})

res.status(404).json({ 
  message: "Not found",
  code: "NOT_FOUND"
})

// Use MedusaError for consistent error handling
import { MedusaError } from "@medusajs/framework/utils"

throw new MedusaError(
  MedusaError.Types.NOT_FOUND,
  "Business not found"
)

throw new MedusaError(
  MedusaError.Types.INVALID_DATA,
  "Status is required"
)

throw new MedusaError(
  MedusaError.Types.UNAUTHORIZED,
  "Not authenticated"
)
```

---

## Validation

### Zod Schemas

```typescript
// src/api/store/validators.ts
import { z } from "zod"

// Query parameter validation
export const ListQuerySchema = z.object({
  status: z.string().min(1).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
}).passthrough()

// Body validation
export const CreateConsultationSchema = z.object({
  patient_id: z.string().uuid(),
  mode: z.enum(["video", "phone", "chat"]),
  chief_complaint: z.string().min(10).max(1000),
  scheduled_at: z.string().datetime().optional(),
})

export type CreateConsultationType = z.infer<typeof CreateConsultationSchema>
```

### Middleware Validation

```typescript
// src/api/middlewares.ts
import { 
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

// Define schemas
const CreateBusinessSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  owner_email: z.string().email(),
})

export default defineMiddlewares({
  routes: [
    // Body validation for POST/PUT
    {
      matcher: "/admin/businesses",
      method: ["POST"],
      middlewares: [
        validateAndTransformBody(CreateBusinessSchema),
      ],
    },
    
    // Query validation for GET (with pagination defaults)
    {
      matcher: "/admin/consultations",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery(
          createFindParams({ limit: 50, offset: 0 }),
          {
            defaults: ["id", "status", "patient_id", "business_id"],
            isList: true,
          }
        ),
      ],
    },
  ],
})
```

### Using Validated Data in Routes

```typescript
// Validated body is available on req.validatedBody
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = req.validatedBody as CreateConsultationType
  // body is type-safe and validated
}

// Validated query config is available on req.queryConfig
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve("query")
  
  const { data, metadata } = await query.graph({
    entity: "consultation",
    fields: req.queryConfig.fields,
    filters: req.validatedQuery,
    pagination: {
      take: req.queryConfig.pagination.take,
      skip: req.queryConfig.pagination.skip,
    },
  })
  
  res.json({ 
    consultations: data,
    count: metadata!.count,
    offset: metadata!.skip,
    limit: metadata!.take,
  })
}
```

### Error Responses

Validation errors return 400 with detailed information:

```json
{
  "type": "invalid_data",
  "message": "Invalid request body",
  "errors": [
    {
      "path": ["name"],
      "message": "Required",
      "code": "invalid_type"
    }
  ]
}
```

---

## Authentication & Authorization

### Protected Routes

```typescript
// Inline authentication in route (recommended for store routes)
import { authenticate } from "@medusajs/framework"

export const GET = [
  authenticate("customer", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    // Only authenticated customers reach here
    const customerId = (req as any).auth_context?.actor_id
    // ...
  },
]
```

### Middleware-based Authentication

```typescript
// src/api/middlewares.ts
import { defineMiddlewares, authenticate } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    // Admin routes - require user authentication
    {
      matcher: "/admin/custom/*",
      middlewares: [
        authenticate("user", ["session", "bearer", "api-key"]),
      ],
    },
    
    // Customer routes
    {
      matcher: "/store/customers/me/*",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
      ],
    },
    
    // Custom actor type (e.g., clinician)
    {
      matcher: "/clinician/*",
      middlewares: [
        authenticate("clinician", ["session", "bearer"]),
      ],
    },
  ],
})
```

### Tenant Scoping Middleware

The codebase implements multi-tenant resolution:

```typescript
// src/api/middlewares/tenant-resolution.ts
export const tenantResolutionMiddleware = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  let business: any = null

  // 1. Check x-tenant-host header (preferred)
  const tenantHost = 
    normalizeHostHeaderValue(req.headers["x-tenant-host"] as any) ||
    normalizeHostHeaderValue(req.headers["x-forwarded-host"] as any) ||
    normalizeHostHeaderValue(req.headers["host"] as any)

  if (tenantHost && !isPlatformHostname(tenantHost)) {
    business = await businessModuleService.getBusinessByDomainFromTable(tenantHost)
  }

  // 2. Check x-business-slug header (backward compat)
  if (!business) {
    const businessSlug = req.headers["x-business-slug"] as string
    if (businessSlug) {
      business = await businessModuleService.getBusinessBySlug(businessSlug)
    }
  }

  // 3. Check query param ?business=slug
  if (!business && req.query.business) {
    business = await businessModuleService.getBusinessBySlug(req.query.business as string)
  }

  // Reject suspended businesses
  if (business && business.status === "suspended") {
    return res.status(404).json({ message: "Store not found" })
  }

  // Attach business to request context
  if (business) {
    (req as any).context = (req as any).context || {}
    (req as any).context.business = business
  }

  next()
}
```

Register in middlewares.ts:
```typescript
export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/*",
      middlewares: [tenantResolutionMiddleware],
    },
  ],
})
```

### Accessing Tenant in Routes

```typescript
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const business = (req as any).context?.business as { id?: string } | undefined
  
  if (!business?.id) {
    return res.status(400).json({ message: "Business context not found" })
  }
  
  // Use business.id for tenant-scoped queries
  const filters = { business_id: business.id }
  // ...
}
```

---

## Middleware

### Built-in Middleware

```typescript
// src/api/middlewares.ts
import { defineMiddlewares } from "@medusajs/framework/http"
import cors from "cors"
import { parseCorsOrigins } from "@medusajs/framework/utils"

export default defineMiddlewares({
  routes: [
    // CORS for custom routes
    {
      matcher: "/custom*",
      middlewares: [
        (req, res, next) => {
          const configModule = req.scope.resolve("configModule")
          return cors({
            origin: parseCorsOrigins(configModule.projectConfig.http.storeCors),
            credentials: true,
          })(req, res, next)
        },
      ],
    },
    
    // Raw body for webhooks
    {
      matcher: "/webhooks/*",
      bodyParser: { preserveRawBody: true },
      method: ["POST"],
    },
    
    // Disable body parsing for file uploads
    {
      matcher: "/admin/documents",
      method: ["POST"],
      middlewares: [
        (req, res, next) => {
          // Body parsing handled by multer
          next()
        },
      ],
    },
  ],
})
```

### Custom Middleware Creation

```typescript
// src/api/middlewares/rate-limiter.ts
import { 
  MedusaRequest, 
  MedusaResponse, 
  MedusaNextFunction 
} from "@medusajs/framework/http"

const requestCounts = new Map<string, { count: number; resetTime: number }>()

export const authRateLimiter = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown"
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const maxRequests = 5
  
  const record = requestCounts.get(ip)
  
  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs })
    return next()
  }
  
  if (record.count >= maxRequests) {
    return res.status(429).json({
      message: "Too many requests, please try again later",
      code: "RATE_LIMIT_EXCEEDED",
    })
  }
  
  record.count++
  next()
}
```

### Middleware Composition

Apply multiple middlewares in sequence:

```typescript
// src/api/middlewares.ts
export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/documents*",
      middlewares: [
        authenticate("user", ["session", "bearer"]),
        tenantAdminAuthMiddleware,
        documentAuditMiddleware,
      ],
    },
    {
      matcher: "/store/carts*",
      middlewares: [
        tenantResolutionMiddleware,
        consultGatingMiddleware,
        auditLoggingMiddleware,
      ],
    },
  ],
})
```

### Route-level Middleware

```typescript
import { authenticate } from "@medusajs/framework"
import { auditLoggingMiddleware } from "../../middlewares/audit-logging"

// Array syntax for route-level middleware
export const GET = [
  authenticate("customer", ["session", "bearer"]),
  auditLoggingMiddleware,
  async (req: MedusaRequest, res: MedusaResponse) => {
    // Handler logic
  },
]
```

---

## Patterns

### Pattern: CRUD Routes for Module Entity

```typescript
// src/api/admin/consultations/route.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONSULTATION_MODULE } from "../../../modules/consultation"

// LIST - GET /admin/consultations
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const consultationService = req.scope.resolve(CONSULTATION_MODULE)
  
  const {
    business_id,
    status,
    limit = "50",
    offset = "0",
  } = req.query as Record<string, string | undefined>

  // Build filters
  const filters: Record<string, any> = {}
  if (business_id) filters.business_id = business_id
  if (status) filters.status = status

  const take = parseInt(limit, 10)
  const skip = parseInt(offset, 10)

  const [consultations, count] = await consultationService.listConsultations(
    filters,
    { skip, take, order: { created_at: "DESC" } }
  )

  res.json({ consultations, count, limit: take, offset: skip })
}

// CREATE - POST /admin/consultations
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const consultationService = req.scope.resolve(CONSULTATION_MODULE)
  const body = req.body as Record<string, any>
  
  const consultation = await consultationService.createConsultation(body)
  res.status(201).json({ consultation })
}
```

```typescript
// src/api/admin/consultations/[id]/route.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONSULTATION_MODULE } from "../../../../modules/consultation"

// RETRIEVE - GET /admin/consultations/:id
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const consultationService = req.scope.resolve(CONSULTATION_MODULE)
  
  const consultation = await consultationService.retrieveConsultation(id)
  res.json({ consultation })
}

// UPDATE - PUT /admin/consultations/:id
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const consultationService = req.scope.resolve(CONSULTATION_MODULE)
  const body = req.body as Record<string, any>
  
  const consultation = await consultationService.updateConsultation(id, body)
  res.json({ consultation })
}

// DELETE - DELETE /admin/consultations/:id
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const consultationService = req.scope.resolve(CONSULTATION_MODULE)
  
  await consultationService.deleteConsultation(id)
  res.status(204).send()
}
```

### Pattern: Tenant-Scoped Query

```typescript
// src/api/store/consultations/route.ts
export const GET = [
  authenticate("customer", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
    
    // Get tenant from middleware context
    const business = (req as any).context?.business as { id?: string } | undefined
    if (!business?.id) {
      return res.status(400).json({ message: "Business context not found" })
    }
    
    // Get customer from auth
    const customerId = (req as any).auth_context?.actor_id
    
    // Scope query to tenant
    const patient = await consultationService
      .getPatientByCustomerId(business.id, customerId)
      .catch(() => null)
    
    if (!patient) {
      return res.json({ consultations: [], count: 0 })
    }
    
    // Filter by both tenant AND customer
    const [consultations, count] = await consultationService.listConsultations(
      { 
        business_id: business.id,  // Tenant scope
        patient_id: patient.id,     // User scope
      },
      { skip: 0, take: 20, order: { created_at: "DESC" } }
    )
    
    res.json({ consultations, count })
  },
]
```

### Pattern: Workflow Execution from Route

```typescript
// src/api/admin/businesses/route.ts
import { provisionBusinessWorkflow } from "../../../workflows/provision-business"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const body = req.body as Record<string, any>

  // 1. Create entity
  const business = await businessModuleService.createBusinesses({
    ...body,
    status: "pending",
  })

  // 2. Execute workflow for side effects
  const { result } = await provisionBusinessWorkflow(req.scope).run({
    input: {
      business_id: business.id,
      storefront_base_url: body.storefront_url,
    },
  })

  res.status(201).json({ business: result })
}
```

### Pattern: File Upload

```typescript
// src/api/admin/documents/route.ts
import { uploadSingleDocument, handleMulterError } from "../../middlewares/document-upload"

// Disable body parsing for multipart
export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Use multer middleware
  uploadSingleDocument(req as any, res as any, async (err: any) => {
    if (err) {
      return handleMulterError(err, req, res, () => {})
    }

    try {
      const complianceService = req.scope.resolve("complianceModuleService")
      const file = (req as any).file
      
      if (!file) {
        return res.status(400).json({
          error: "No file uploaded",
          message: "Please provide a file in the 'document' field",
        })
      }

      const body = (req.body ?? {}) as Record<string, any>
      const uploadedBy = (req as any).auth_context?.actor_id || "unknown"

      const document = await complianceService.uploadDocument(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          business_id: body.business_id,
          patient_id: body.patient_id,  // PHI in body (secure)
          type: body.type,
          access_level: body.access_level,
        },
        uploadedBy
      )

      res.status(201).json({ document })
    } catch (error) {
      res.status(500).json({
        error: "Failed to upload document",
        message: error.message,
      })
    }
  })
}
```

### Pattern: Pagination

```typescript
// Standard pagination with limit/offset
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const consultationService = req.scope.resolve(CONSULTATION_MODULE)
  
  // Parse with defaults and bounds
  const take = Math.min(
    Math.max(parseInt(req.query.limit as string) || 20, 1), 
    100  // Max 100
  )
  const skip = Math.max(parseInt(req.query.offset as string) || 0, 0)
  
  const [consultations, count] = await consultationService.listConsultations(
    {},
    { skip, take, order: { created_at: "DESC" } }
  )
  
  res.json({
    consultations,
    count,
    limit: take,
    offset: skip,
  })
}
```

### Pattern: Search

```typescript
// GET with search/filter parameters
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const consultationService = req.scope.resolve(CONSULTATION_MODULE)
  
  const {
    q,           // Search query
    status,
    date_from,
    date_to,
    limit = "50",
    offset = "0",
  } = req.query as Record<string, string | undefined>
  
  const filters: Record<string, any> = {}
  
  // Text search (requires .searchable() in data model)
  if (q) {
    filters.q = q
  }
  
  // Status filter
  if (status) {
    filters.status = status
  }
  
  // Date range filtering
  if (date_from || date_to) {
    filters.scheduled_at = {}
    if (date_from) filters.scheduled_at.$gte = new Date(date_from)
    if (date_to) filters.scheduled_at.$lte = new Date(date_to)
  }
  
  const [consultations, count] = await consultationService.listConsultations(
    filters,
    { 
      skip: parseInt(offset, 10), 
      take: parseInt(limit, 10),
      order: { created_at: "DESC" },
    }
  )
  
  res.json({ consultations, count })
}
```

---

## HIPAA-Compliant Patterns

### Audit Logging Integration

```typescript
// Automatic audit logging via middleware (configured in middlewares.ts)
{
  matcher: "/admin/consultations*",
  middlewares: [auditLoggingMiddleware],
}

// Manual audit logging in route handlers
import { logAuditEvent } from "../../middlewares/audit-logging"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // ... fetch document logic
  
  // Log access manually
  await logAuditEvent(req, {
    action: "read",
    entityType: "document",
    entityId: document.id,
    businessId: document.business_id,
    consultationId: document.consultation_id,
    riskLevel: "medium",
  })
  
  res.json({ document })
}
```

### PHI Protection in URLs (HIPAA-008)

```typescript
// ❌ BAD: PHI in query params (logged in access logs)
GET /admin/documents?patient_id=pat_123&consultation_id=cons_456

// ✅ GOOD: PHI in request body
POST /admin/documents/search
{
  "patient_id": "pat_123",
  "consultation_id": "cons_456"
}

// Implementation
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as { patient_id?: string; consultation_id?: string }
  
  // PHI is in body, not URL - won't appear in access logs
  const filters = {
    patient_id: body.patient_id,
    consultation_id: body.consultation_id,
  }
  
  const documents = await complianceService.listDocuments(filters)
  res.json({ documents })
}
```

### Data Sanitization for Response

```typescript
// Remove internal/sensitive fields before sending to client
function sanitizeConsultationForPatient(consultation: any): any {
  return {
    id: consultation.id,
    status: consultation.status,
    mode: consultation.mode,
    scheduled_at: consultation.scheduled_at,
    chief_complaint: consultation.chief_complaint,
    outcome: consultation.outcome,
    // Exclude: internal_notes, clinician_private_notes, etc.
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const consultations = await fetchConsultations()
  
  // Sanitize based on user role
  const sanitized = consultations.map(c => 
    sanitizeConsultationForPatient(c)
  )
  
  res.json({ consultations: sanitized })
}
```

---

## Reference

### Request/Response Types

```typescript
import { 
  MedusaRequest,
  MedusaResponse,
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
} from "@medusajs/framework/http"

// Request object properties
interface MedusaRequest {
  params: Record<string, string>           // URL parameters
  query: Record<string, any>               // Query parameters
  body: any                                // Request body
  headers: Record<string, string>          // HTTP headers
  scope: MedusaContainer                   // Dependency injection container
  validatedBody: any                       // After validateAndTransformBody
  validatedQuery: any                      // After validateAndTransformQuery
  queryConfig: {
    fields: string[]
    pagination: { take: number; skip: number }
  }
}

// Auth context (available on AuthenticatedMedusaRequest)
interface AuthContext {
  actor_id: string
  actor_type: "user" | "customer" | "clinician" | string
  auth_identity_id: string
}
```

### Common HTTP Patterns

```typescript
// GET with optional filters
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const filters: Record<string, any> = {}
  
  if (req.query.status) filters.status = req.query.status
  if (req.query.business_id) filters.business_id = req.query.business_id
  
  // Date range
  if (req.query.date_from || req.query.date_to) {
    filters.created_at = {}
    if (req.query.date_from) filters.created_at.$gte = new Date(req.query.date_from as string)
    if (req.query.date_to) filters.created_at.$lte = new Date(req.query.date_to as string)
  }
  
  const [data, count] = await service.list(filters, {
    skip: parseInt(req.query.offset as string) || 0,
    take: Math.min(parseInt(req.query.limit as string) || 20, 100),
  })
  
  res.json({ data, count })
}

// POST with validation
export const POST = [
  validateAndTransformBody(CreateSchema),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const body = req.validatedBody
    const created = await service.create(body)
    res.status(201).json({ data: created })
  },
]

// PUT with partial update
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const body = req.body as Record<string, any>
  
  const updated = await service.update(id, body)
  res.json({ data: updated })
}

// DELETE with cleanup
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  
  await service.delete(id)
  res.status(204).send()
}
```

### Error Handling

```typescript
import { MedusaError } from "@medusajs/framework/utils"

// Standard error types
MedusaError.Types.NOT_FOUND           // 404
MedusaError.Types.INVALID_DATA        // 400
MedusaError.Types.UNAUTHORIZED        // 401
MedusaError.Types.NOT_ALLOWED         // 403
MedusaError.Types.UNEXPECTED_STATE    // 400
MedusaError.Types.DB_ERROR            // 500
MedusaError.Types.DUPLICATE_ERROR     // 409

// Throw in routes or services
throw new MedusaError(
  MedusaError.Types.NOT_FOUND,
  `Consultation with id ${id} not found`
)

throw new MedusaError(
  MedusaError.Types.INVALID_DATA,
  "Business ID is required"
)

throw new MedusaError(
  MedusaError.Types.UNAUTHORIZED,
  "You must be logged in to access this resource"
)
```

### Container Resolution

```typescript
// In API routes
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // Custom module
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  
  // Core Medusa services
  const query = req.scope.resolve("query")
  const link = req.scope.resolve("link")
  const logger = req.scope.resolve("logger")
  const eventBus = req.scope.resolve("eventBus")
  
  // With type safety
  const productService = req.scope.resolve(Modules.PRODUCT)
  const customerService = req.scope.resolve(Modules.CUSTOMER)
}
```

---

## Quick Reference: File Structure

```
src/api/
├── middlewares.ts                    # Global middleware config
├── middlewares/
│   ├── tenant-resolution.ts          # Multi-tenant support
│   ├── audit-logging.ts              # HIPAA audit logging
│   ├── rate-limiter.ts               # Rate limiting
│   └── document-upload.ts            # File upload handling
├── admin/
│   ├── businesses/
│   │   ├── route.ts                  # GET, POST
│   │   └── [id]/
│   │       └── route.ts              # GET, PUT, DELETE
│   ├── consultations/
│   │   ├── route.ts                  # GET, POST
│   │   └── [id]/
│   │       └── route.ts              # GET, PUT, DELETE
│   └── documents/
│       └── route.ts                  # GET, POST (file upload)
└── store/
    ├── businesses/
    │   └── route.ts                  # GET
    ├── consultations/
    │   └── route.ts                  # GET, POST
    └── documents/
        └── route.ts                  # GET
```

## Quick Reference: Essential Imports

```typescript
// Framework
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate, defineMiddlewares } from "@medusajs/framework/http"
import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

// Core validators
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

// Modules
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../../modules/business"
import { CONSULTATION_MODULE } from "../../../modules/consultation"
```
