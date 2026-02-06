# Quickstart - Copy-Paste Patterns for Common Tasks

> Don't think. Copy. Adapt. Ship.

---

## Pattern 1: Add a New Data Model (Business-scoped)

**Use when**: Adding a new entity like "InsurancePlan", "Prescription", "Facility"

```typescript
// src/modules/business/models/insurance-plan.ts
import { model } from "@medusajs/framework/utils"
import Business from "./business"

const InsurancePlan = model.define("insurance_plan", {
  id: model.id().primaryKey(),
  business: model.belongsTo(() => Business, { mappedBy: "insurance_plans" }),
  
  // Your fields
  name: model.text(),
  provider: model.text(),
  policy_number: model.text(),
  coverage_details: model.json().default({}),
  is_active: model.boolean().default(true),
  
  // Timestamps auto-managed
}).indexes([
  { on: ["business_id", "name"], unique: true },
])

export default InsurancePlan
```

```typescript
// Update src/modules/business/models/business.ts
import InsurancePlan from "./insurance-plan"

const Business = model.define("business", {
  // ... existing fields
  insurance_plans: model.hasMany(() => InsurancePlan, { mappedBy: "business" }),
})
```

```typescript
// src/modules/business/index.ts - Add to service
import { MedusaService } from "@medusajs/framework/utils"
import InsurancePlan from "./models/insurance-plan"

export default class BusinessModuleService extends MedusaService({
  // ... existing models
  InsurancePlan,  // ← Add this
}) {}
```

**Then run**: `npx medusa db:migrate`

---

## Pattern 2: Create a Workflow with Compensation

**Use when**: Multi-step process that needs rollback on failure

```typescript
// src/workflows/process-insurance-verification.ts
import { 
  createWorkflow, 
  WorkflowResponse,
  createStep,
  StepResponse,
  when,
  transform,
} from "@medusajs/framework/workflows-sdk"

// Step 1: Create the record
const createVerificationStep = createStep(
  "create-verification",
  async (input: { patient_id: string; insurance_id: string }, { container }) => {
    const service = container.resolve("businessModuleService")
    
    const verification = await service.createInsuranceVerifications({
      patient_id: input.patient_id,
      insurance_id: input.insurance_id,
      status: "pending",
    })
    
    // Return result + compensation data
    return new StepResponse(verification, verification.id)
  },
  // Compensation (rollback) function
  async (createdId: string, { container }) => {
    if (!createdId) return
    const service = container.resolve("businessModuleService")
    await service.deleteInsuranceVerifications(createdId)
  }
)

// Step 2: Conditional processing
const processVerificationStep = createStep(
  "process-verification",
  async (verification: any, { container }) => {
    // Call external API, etc.
    const result = await verifyWithInsuranceProvider(verification)
    return new StepResponse(result)
  }
)

// Workflow definition
export const processInsuranceVerificationWorkflow = createWorkflow(
  "process-insurance-verification",
  (input: { patient_id: string; insurance_id: string }) => {
    const verification = createVerificationStep(input)
    
    // Conditional: only process if active
    const result = when(input, (data) => !!data.insurance_id)
      .then(() => processVerificationStep(verification))
    
    return new WorkflowResponse({ verification, result })
  }
)

// Execute in API route or subscriber:
// const { result } = await processInsuranceVerificationWorkflow(container).run({ input })
```

---

## Pattern 3: Create an Admin API Route

**Use when**: New endpoint for admin dashboard

```typescript
// src/api/admin/insurance-verifications/route.ts
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

// Validation schema
const CreateVerificationSchema = z.object({
  patient_id: z.string(),
  insurance_id: z.string(),
})

// GET /admin/insurance-verifications - List
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const businessModuleService = req.scope.resolve("businessModuleService")
  
  // If tenant-scoped
  const business_id = req.query.business_id as string
  
  const [verifications, count] = await businessModuleService
    .listAndCountInsuranceVerifications(
      { business_id },  // Filter
      { 
        take: parseInt(req.query.limit as string) || 20,
        skip: parseInt(req.query.offset as string) || 0,
      }
    )
  
  res.json({ verifications, count })
}

// POST /admin/insurance-verifications - Create
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const validated = CreateVerificationSchema.parse(req.body)
  const businessModuleService = req.scope.resolve("businessModuleService")
  
  const verification = await businessModuleService.createInsuranceVerifications(validated)
  
  res.status(201).json({ verification })
}
```

---

## Pattern 4: Create a Subscriber (Event Handler)

**Use when**: Reacting to events (order created, consultation completed, etc.)

```typescript
// src/subscribers/insurance-verification-requested.ts
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { processInsuranceVerificationWorkflow } from "../workflows/process-insurance-verification"

// What events to listen for
export const config: SubscriberConfig = {
  event: "insurance.verification_requested",
}

export default async function handler({
  event: { data },
  container,
}: SubscriberArgs<{ patient_id: string; insurance_id: string }>) {
  // Execute workflow
  await processInsuranceVerificationWorkflow(container).run({
    input: {
      patient_id: data.patient_id,
      insurance_id: data.insurance_id,
    },
  })
  
  // Or call service directly for simple cases
  // const service = container.resolve("businessModuleService")
  // await service.createInsuranceVerifications(data)
}
```

**Emit the event**:
```typescript
// From anywhere with container access
const eventBus = container.resolve("eventBus")
await eventBus.emit("insurance.verification_requested", {
  patient_id: "pat_123",
  insurance_id: "ins_456",
})
```

---

## Pattern 5: Create a Scheduled Job

**Use when**: Periodic background task

```typescript
// src/jobs/process-pending-verifications.ts
import { MedusaContainer } from "@medusajs/framework/types"

export default async function processPendingVerifications(container: MedusaContainer) {
  const businessModuleService = container.resolve("businessModuleService")
  
  // Find pending verifications
  const pending = await businessModuleService.listInsuranceVerifications({
    status: "pending",
    created_at: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Older than 24h
  })
  
  // Process each
  for (const verification of pending) {
    // Process or escalate
  }
  
  console.log(`Processed ${pending.length} pending verifications`)
}

// Config (in the file or separate)
export const config = {
  name: "process-pending-verifications",
  schedule: "0 */6 * * *", // Every 6 hours
}
```

---

## Common Snippets

### Resolve Service
```typescript
const service = container.resolve("businessModuleService")
const query = container.resolve("query")
const eventBus = container.resolve("eventBus")
const workflowEngine = container.resolve("workflowEngine")
```

### Query with Links
```typescript
const { data: businesses } = await query.graph({
  entity: "business",
  fields: ["id", "name", "locations.*", "orders.*"],
  filters: { id: businessId },
})
```

### Emit Audit Log
```typescript
// This happens automatically via middleware for API routes
// For manual logging:
const auditService = container.resolve("complianceModuleService")
auditService.createAuditLogs({
  action: "INSURANCE_VERIFIED",
  entity_type: "insurance_verification",
  entity_id: verification.id,
  changes: { before: null, after: verification },
})
```

### Error Handling
```typescript
import { MedusaError } from "@medusajs/framework/utils"

if (!business) {
  throw new MedusaError(
    MedusaError.Types.NOT_FOUND,
    `Business with id ${id} not found`
  )
}
```

---

## Next Steps

1. **Copy** the pattern you need
2. **Adapt** the names/fields to your use case
3. **Check** the full guide in ../02_BUILDING/ for edge cases
4. **Test** with `npm run test` or manually

**Need more detail?** Go to [DECISION_TREE.md](./DECISION_TREE.md)
