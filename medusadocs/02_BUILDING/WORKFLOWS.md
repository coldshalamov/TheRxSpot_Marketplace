# Building Workflows

## TL;DR

**When to use workflows vs direct service calls:**
- Use **workflows** for: multi-step operations, data that spans modules, operations needing rollback, async/long-running processes, critical business logic
- Use **direct service calls** for: simple CRUD, single-module operations, read-only operations

**3-step pattern:**
```typescript
// 1. Create the step
const myStep = createStep("step-name", async (input, { container }) => {
  const service = container.resolve(MY_MODULE)
  const result = await service.create(input)
  return new StepResponse(result, result.id) // result + compensation data
}, async (id, { container }) => {
  // Compensation (rollback) function
  if (id) await container.resolve(MY_MODULE).delete(id)
})

// 2. Create the workflow
export const myWorkflow = createWorkflow("workflow-name", (input) => {
  const result = myStep(input)
  return new WorkflowResponse(result)
})

// 3. Execute
const { result } = await myWorkflow(container).run({ input: { ... } })
```

**Common pitfalls:**
- Don't use `if/else` or loops directly in workflow constructor - use `when-then` and `transform`
- Steps must be pure functions - no side effects outside the step
- Always pass compensation data to `StepResponse` for rollback
- Don't resolve services outside steps - always use `container.resolve()` inside steps

---

## Core Concepts

### What are workflows (and why use them)

Workflows are special functions composed of steps that guarantee data consistency with automatic rollback mechanisms. They're Medusa's solution for complex business logic that spans multiple modules or external systems.

**Key benefits:**
- **Automatic rollback**: If any step fails, previous steps' compensation functions run to undo changes
- **Execution tracking**: Every workflow execution is tracked with status, steps, input, and output
- **Async support**: Long-running workflows can pause and resume
- **Module isolation**: Workflows are the only place where multiple modules can interact

From the codebase (`src/workflows/provision-business.ts`):
```typescript
export const provisionBusinessWorkflow = createWorkflow(
  "provision-business",
  (input: ProvisionInput) => {
    const business = getBusinessStep(input)
    
    // Use core workflows as steps
    const salesChannels = createSalesChannelsWorkflow.runAsStep({...})
    const apiKeys = createApiKeysWorkflow.runAsStep({...})
    
    // Transform data between steps
    const salesChannelId = transform({ salesChannels }, (data) => {
      return data.salesChannels[0].id
    })
    
    // Link resources
    linkSalesChannelsToApiKeyWorkflow.runAsStep({...})
    
    return new WorkflowResponse(updatedBusiness)
  }
)
```

### Steps and StepResponse

Steps are the building blocks of workflows. Each step:
- Receives input and a context object with `container`
- Returns a `StepResponse` with the result and compensation data
- Runs in isolation with its own transaction

**StepResponse patterns:**
```typescript
// Basic response with compensation data (for rollback)
return new StepResponse(result, result.id)

// Response without compensation (no rollback needed)
return new StepResponse(result)

// Permanent failure - triggers compensation
return StepResponse.permanentFailure("Error message", compensationData)
```

From `src/workflows/consult-gating/index.ts`:
```typescript
const checkProductRequiresConsultStep = createStep<
  ValidateConsultApprovalInput,
  CheckProductRequiresConsultOutput,
  CheckProductRequiresConsultOutput
>(
  "check-product-requires-consult",
  async (input, { container }) => {
    const productService = container.resolve(Modules.PRODUCT)
    const product = await productService.retrieveProduct(input.product_id)
    
    return new StepResponse({
      valid: true,
      requires_consult: requiresConsult,
      message: "OK",
    })
  }
)
```

### Compensation (rollback) functions

Compensation functions undo a step's actions when the workflow fails. They're the third parameter to `createStep`.

**Key rules:**
- Compensation data should be the minimal info needed to undo (usually just the ID)
- Always check if compensation data exists before using it
- Compensation functions run in reverse order of step execution

```typescript
const createBrandStep = createStep(
  "create-brand-step",
  async (input: { name: string }, { container }) => {
    const brandModuleService = container.resolve(BRAND_MODULE)
    const brand = await brandModuleService.createBrands(input)
    return new StepResponse(brand, brand.id) // Pass ID for compensation
  },
  // Compensation function
  async (id: string, { container }) => {
    if (!id) return // Always check
    const brandModuleService = container.resolve(BRAND_MODULE)
    await brandModuleService.deleteBrands(id)
  }
)
```

---

## Building Workflows

### Simple workflow

```typescript
import { 
  createWorkflow, 
  WorkflowResponse,
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { BUSINESS_MODULE } from "../modules/business"

const getBusinessStep = createStep(
  "get-business",
  async (input: { business_id: string }, { container }) => {
    const businessService = container.resolve(BUSINESS_MODULE)
    const business = await businessService.retrieveBusiness(input.business_id)
    return new StepResponse(business)
  }
)

export const getBusinessWorkflow = createWorkflow(
  "get-business",
  (input: { business_id: string }) => {
    const business = getBusinessStep(input)
    return new WorkflowResponse(business)
  }
)
```

### Workflow with compensation

```typescript
const createConsultApprovalStep = createStep<
  CreateApprovalInput,
  CreateApprovalOutput,
  string  // Compensation data type
>(
  "create-consult-approval",
  async (input, { container }) => {
    const businessService = container.resolve(BUSINESS_MODULE)
    const approval = await businessService.createConsultApprovals({
      customer_id: input.customer_id,
      product_id: input.product_id,
      status: "approved",
    })
    
    // Pass approval.id for compensation
    return new StepResponse({
      success: true,
      approval_id: approval.id,
    }, approval.id)
  },
  // Rollback: delete the approval if workflow fails
  async (approvalId, { container }) => {
    if (!approvalId) return
    const businessService = container.resolve(BUSINESS_MODULE)
    await businessService.deleteConsultApprovals(approvalId)
  }
)
```

### Conditional logic (when-then)

You cannot use regular `if/else` in workflows. Use `when-then` instead:

```typescript
import { when } from "@medusajs/framework/workflows-sdk"

export const conditionalWorkflow = createWorkflow(
  "conditional-workflow",
  (input: { is_active: boolean; name: string }) => {
    // If condition
    when(input, (data) => data.is_active === true)
      .then(() => {
        activateStep({ name: input.name })
      })

    // Else condition (inverse check)
    when(input, (data) => data.is_active === false)
      .then(() => {
        deactivateStep({ name: input.name })
      })

    return new WorkflowResponse({ success: true })
  }
)
```

**Important:** When returning data from `when-then`, you must name the block:
```typescript
const result = when(
  "my-conditional-step",  // Required name
  input,
  (data) => data.shouldProcess
).then(() => {
  return processStep(input)
})
```

### Data transformation (transform)

Use `transform` to manipulate data between steps. You cannot use regular JavaScript operations in the workflow constructor.

```typescript
import { transform } from "@medusajs/framework/workflows-sdk"

export const provisionBusinessWorkflow = createWorkflow(
  "provision-business",
  (input: ProvisionInput) => {
    const business = getBusinessStep(input)
    
    // Transform: derive sales channel name from business
    const salesChannelName = transform({ business }, (data) => {
      return `SC: ${data.business.name}`
    })
    
    // Transform: extract ID from nested result
    const salesChannelId = transform({ salesChannels }, (data) => {
      return data.salesChannels[0].id
    })
    
    // Transform: build settings object
    const settings = transform({ input, business }, (data) => ({
      storefront_url: data.input.storefront_base_url,
      business_slug: data.business.slug,
    }))
    
    const updated = updateBusinessStep({ settings })
    return new WorkflowResponse(updated)
  }
)
```

**Transform use cases:**
- Creating dates: `transform({}, () => new Date())`
- Mapping arrays: `transform({ items }, (data) => data.items.map(i => i.id))`
- Building input objects for nested workflows

### Parallel execution

Run independent steps in parallel using `parallelize`:

```typescript
import { parallelize } from "@medusajs/framework/workflows-sdk"

export const parallelWorkflow = createWorkflow(
  "parallel-workflow",
  (input: { productIds: string[] }) => {
    // These steps run in parallel
    const [prices, inventory, categories] = parallelize(
      fetchPricesStep({ ids: input.productIds }),
      fetchInventoryStep({ ids: input.productIds }),
      fetchCategoriesStep({ ids: input.productIds })
    )
    
    // Continue with combined results
    const result = combineStep({ prices, inventory, categories })
    return new WorkflowResponse(result)
  }
)
```

### Long-running workflows

For async operations that may take time (external API calls, waiting for human approval):

```typescript
const asyncStep = createStep(
  "async-step",
  async (input, { container }) => {
    // Start async operation (e.g., send to external system)
    const externalId = await startExternalProcess(input)
    
    // Return without StepResponse - workflow pauses here
    // The step will be resumed when external process completes
  },
  async (externalId, { container }) => {
    // Cancel the external process if workflow fails
    await cancelExternalProcess(externalId)
  },
  {
    async: true  // Mark as async step
  }
)

// In another workflow or API, resume the step:
const workflowEngine = container.resolve(Modules.WORKFLOW_ENGINE)
await workflowEngine.setStepSuccess({
  workflowId: "workflow-id",
  stepId: "async-step",
  response: { success: true, data: result }
})
```

---

## Executing Workflows

### From API routes

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { provisionBusinessWorkflow } from "../../workflows/provision-business"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await provisionBusinessWorkflow(req.scope).run({
    input: {
      business_id: req.body.business_id,
      storefront_base_url: req.body.storefront_base_url,
    }
  })
  
  res.json({ business: result })
}
```

### From subscribers

```typescript
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { initializeOrderWorkflow } from "../workflows/order-lifecycle"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await initializeOrderWorkflow(container).run({
    input: {
      orderId: data.id,
      requiresConsultation: true,
      businessId: "...",
      items: [],
    }
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
```

### From scheduled jobs

```typescript
import { MedusaContainer } from "@medusajs/framework/types"
import { syncExternalDataWorkflow } from "../workflows/sync-external"

export default async function syncJob(container: MedusaContainer) {
  await syncExternalDataWorkflow(container).run({
    input: { syncType: "daily" }
  })
}

export const config = {
  name: "daily-sync",
  schedule: "0 0 * * *", // Daily at midnight
}
```

### From other workflows (nesting)

```typescript
export const parentWorkflow = createWorkflow(
  "parent-workflow",
  (input: ParentInput) => {
    // Run child workflow as a step
    const provisionResult = provisionBusinessWorkflow.runAsStep({
      input: {
        business_id: input.businessId,
        storefront_base_url: input.storefrontUrl,
      }
    })
    
    // Transform result for next step
    const nextInput = transform({ provisionResult }, (data) => ({
      salesChannelId: data.provisionResult.sales_channel_id,
    }))
    
    const finalResult = anotherStep(nextInput)
    return new WorkflowResponse(finalResult)
  }
)
```

---

## Patterns

### Pattern: Multi-step with rollback

```typescript
const validateCartStep = createStep("validate-cart", async (input, { container }) => {
  // Validation logic
  if (!valid) {
    throw new Error("Invalid cart")
  }
  return new StepResponse({ valid: true })
})

const createOrderStep = createStep(
  "create-order",
  async (input, { container }) => {
    const orderService = container.resolve(Modules.ORDER)
    const order = await orderService.createOrders(input)
    return new StepResponse(order, order.id) // Pass ID for rollback
  },
  async (orderId, { container }) => {
    if (!orderId) return
    const orderService = container.resolve(Modules.ORDER)
    await orderService.deleteOrders(orderId)
  }
)

const createPaymentStep = createStep(
  "create-payment",
  async (input, { container }) => {
    const paymentService = container.resolve(Modules.PAYMENT)
    const payment = await paymentService.createSessions(input)
    return new StepResponse(payment, payment.id)
  },
  async (paymentId, { container }) => {
    if (!paymentId) return
    const paymentService = container.resolve(Modules.PAYMENT)
    await paymentService.deleteSessions(paymentId)
  }
)

export const checkoutWorkflow = createWorkflow(
  "checkout",
  (input: CheckoutInput) => {
    validateCartStep({ cartId: input.cartId })
    const order = createOrderStep({ items: input.items })
    const payment = createPaymentStep({ orderId: order.id })
    
    return new WorkflowResponse({ order, payment })
  }
)
// If createPaymentStep fails, createOrderStep's compensation runs
```

### Pattern: Long-running with async steps

For workflows waiting on external systems or human approval:

```typescript
// Step 1: Initiate external process
const initiatePaymentStep = createStep(
  "initiate-payment",
  async (input, { container }) => {
    const paymentProvider = container.resolve("payment-provider")
    const session = await paymentProvider.initiate(input.amount)
    
    // Store session ID for later
    return new StepResponse({ sessionId: session.id }, session.id)
  },
  async (sessionId, { container }) => {
    if (!sessionId) return
    const paymentProvider = container.resolve("payment-provider")
    await paymentProvider.cancel(sessionId)
  }
)

// Step 2: Wait for webhook (async)
const waitForPaymentStep = createStep(
  "wait-for-payment",
  async (input, { container }) => {
    // This returns nothing - workflow pauses
    // Webhook handler will resume this step
  },
  async (_, { container }) => {
    // Cleanup if workflow cancelled
  },
  { async: true }
)

// Step 3: Complete order
const completeOrderStep = createStep("complete-order", async (input, { container }) => {
  const orderService = container.resolve(Modules.ORDER)
  const order = await orderService.updateOrders({
    id: input.orderId,
    status: "completed",
  })
  return new StepResponse(order)
})

// Webhook handler to resume workflow:
export async function paymentWebhook(req, res) {
  const workflowEngine = req.scope.resolve(Modules.WORKFLOW_ENGINE)
  
  await workflowEngine.setStepSuccess({
    workflowId: req.body.workflow_id,
    stepId: "wait-for-payment",
    response: { 
      success: true, 
      data: { status: req.body.status }
    }
  })
  
  res.json({ received: true })
}
```

### Pattern: Query within workflow (useQueryGraphStep)

```typescript
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"

export const queryWorkflow = createWorkflow(
  "query-workflow",
  (input: { cartId: string }) => {
    // Query with relations
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: [
        "id",
        "items.id",
        "items.product.id",
        "items.product.title",
        "items.product.metadata",
        "customer_id",
        "email",
      ],
      filters: { id: input.cartId },
    })
    
    const cart = transform({ carts }, (data) => data.carts[0])
    
    // Continue with queried data
    const validation = validateCartStep({ cart })
    
    return new WorkflowResponse({ cart, validation })
  }
)
```

### Pattern: Emit event from workflow

```typescript
import { emitEventStep } from "@medusajs/medusa/core-flows"

export const orderWorkflow = createWorkflow(
  "process-order",
  (input: OrderInput) => {
    const order = createOrderStep(input)
    
    // Emit custom event
    emitEventStep({
      eventName: "order.created",
      data: { 
        id: order.id,
        customer_id: input.customerId,
      },
    })
    
    return new WorkflowResponse(order)
  }
)
```

### Pattern: Link entities in workflow (createRemoteLinkStep)

```typescript
import { 
  createRemoteLinkStep,
  dismissRemoteLinkStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"

export const linkWorkflow = createWorkflow(
  "link-entities",
  (input: { productId: string; businessId: string }) => {
    // Create link between modules
    createRemoteLinkStep({
      [Modules.PRODUCT]: { product_id: input.productId },
      [BUSINESS_MODULE]: { business_id: input.businessId },
    })
    
    // Dismiss (remove) link
    // dismissRemoteLinkStep({...})
    
    return new WorkflowResponse({ linked: true })
  }
)
```

---

## Reference

### Built-in steps from core-flows

```typescript
import { 
  // Query steps
  useQueryGraphStep,
  useRemoteQueryStep,
  
  // Entity steps
  createEntitiesStep,
  deleteEntitiesStep,
  updateRemoteLinksStep,
  
  // Link steps
  createRemoteLinkStep,
  dismissRemoteLinkStep,
  removeRemoteLinkStep,
  
  // Event steps
  emitEventStep,
  
  // Core workflows (can use .runAsStep())
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  completeCartWorkflow,
  // ... and many more
} from "@medusajs/medusa/core-flows"
```

### Error handling strategies

**1. Throw to trigger compensation:**
```typescript
const step = createStep("my-step", async (input, { container }) => {
  const result = await riskyOperation()
  if (!result.success) {
    throw new Error("Operation failed") // Triggers compensation
  }
  return new StepResponse(result)
})
```

**2. Return error in response:**
```typescript
const step = createStep("my-step", async (input, { container }) => {
  try {
    const result = await operation()
    return new StepResponse({ success: true, data: result })
  } catch (error) {
    return new StepResponse({ 
      success: false, 
      error: error.message 
    })
  }
})
```

**3. Step configuration options:**
```typescript
const step = createStep(
  "my-step",
  async (input, { container }) => { ... },
  async (compensationData, { container }) => { ... },
  {
    async: true,                    // Long-running step
    timeout: 30000,                 // 30 second timeout
    maxRetries: 3,                  // Retry on failure
    retryInterval: 1000,            // Wait 1s between retries
    skipOnPermanentFailure: false,  // Don't skip if permanent failure
    continueOnPermanentFailure: false, // Don't continue if permanent failure
  }
)
```

### Testing workflows

```typescript
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createPostWorkflow } from "../workflows/create-post"

medusaIntegrationTestRunner({
  test suites: [
    {
      name: "workflow tests",
      tests: [
        {
          name: "creates post successfully",
          async ({ container }) => {
            const { result } = await createPostWorkflow(container).run({
              input: { title: "Test Post" }
            })
            
            expect(result).toEqual(
              expect.objectContaining({
                title: "Test Post",
              })
            )
          },
        },
        {
          name: "compensates on failure",
          async ({ container }) => {
            // Mock failure in second step
            jest.spyOn(service, "secondOperation").mockRejectedValue(new Error("Fail"))
            
            // First step's compensation should run
            const deleteSpy = jest.spyOn(service, "delete")
            
            await expect(
              workflow(container).run({ input: {} })
            ).rejects.toThrow("Fail")
            
            expect(deleteSpy).toHaveBeenCalled()
          },
        },
      ],
    },
  ],
})
```

### Common errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot read property 'X' of undefined` | Trying to access step result properties directly in workflow constructor | Use `transform` to access properties |
| `Step not found` | Step defined outside workflow file not exported/imported properly | Ensure step is exported and imported |
| `Compensation not running` | Compensation data is undefined | Always check if compensation data exists before using |
| `Workflow hangs` | Async step never resumed | Check that `setStepSuccess` or `setStepFailure` is called |
| `Cannot use if statement` | Using regular JS conditionals in workflow | Use `when-then` for conditions |
| `Transaction already completed` | Trying to use transaction after step completes | Don't store transaction references between steps |

---

## Quick Reference: Workflow Structure

```typescript
// File: src/workflows/my-feature/index.ts

import {
  createWorkflow,
  WorkflowResponse,
  createStep,
  StepResponse,
  transform,
  when,
  parallelize,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { MY_MODULE } from "../../modules/my-module"
import { useQueryGraphStep, emitEventStep } from "@medusajs/medusa/core-flows"

// Types
export type MyWorkflowInput = { ... }
export type MyWorkflowOutput = { ... }

// Steps
const stepOne = createStep(
  "step-one",
  async (input: InputType, { container }) => {
    const service = container.resolve(MY_MODULE)
    const result = await service.create(input)
    return new StepResponse(result, result.id)
  },
  async (id, { container }) => {
    if (!id) return
    await container.resolve(MY_MODULE).delete(id)
  }
)

// Workflow
export const myWorkflow = createWorkflow(
  "my-workflow",
  (input: MyWorkflowInput) => {
    // Query data
    const { data } = useQueryGraphStep({ entity: "...", fields: ["*"] })
    
    // Transform
    const transformed = transform({ input, data }, (d) => ({ ... }))
    
    // Conditional
    when(input, (i) => i.shouldProcess).then(() => {
      stepOne(transformed)
    })
    
    // Parallel
    const [a, b] = parallelize(stepA(input), stepB(input))
    
    // Emit event
    emitEventStep({ eventName: "my.event", data: { ... } })
    
    return new WorkflowResponse({ a, b })
  }
)
```
