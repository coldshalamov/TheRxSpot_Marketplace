# Troubleshooting

> Common issues and solutions for Medusa V2 development

---

## Database Issues

### Migration fails

**Symptom**: `npx medusa db:migrate` fails with SQL errors

**Solutions**:
```bash
# 1. Check database connection
npx medusa db:setup --db medusa-store

# 2. Generate fresh migrations
npx medusa db:generate myModule

# 3. Reset and re-run
npx medusa db:rollback myModule
npx medusa db:migrate

# 4. Check for pending migrations
npx medusa db:show-pending
```

**Common Causes**:
- Existing data conflicts with new constraints
- Manual DB changes not reflected in migrations
- Multiple developers generating migrations

---

### Entity not found

**Symptom**: `Entity "xyz" was not found` error

**Solutions**:
```typescript
// 1. Verify module is registered in medusa-config.ts
modules: [
  {
    resolve: "./src/modules/my-module",
  },
]

// 2. Check entity name matches model.define
const MyEntity = model.define("my_entity", { ... })  // Use snake_case

// 3. Verify module is loaded (check console output on startup)
// Should see: "Loading module: myModule"

// 4. Query with correct entity name
const { data } = await query.graph({
  entity: "my_entity",  // Must match model.define first param
  fields: ["*"],
})
```

---

### Link table not created

**Symptom**: Cannot query linked data, link table missing

**Solutions**:
```bash
# Sync links after creating link files
npx medusa db:sync-links

# Verify links are loading
# Check console for: "Syncing module links..."
```

```typescript
// Ensure link file is in src/links/
// src/links/my-module-product.ts

import { defineLink } from "@medusajs/framework/utils"
import MyModule from "../modules/my-module"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  MyModule.linkable.myEntity,
  ProductModule.linkable.product
)
```

---

## Workflow Issues

### Compensation not running

**Symptom**: Workflow fails but compensation doesn't execute

**Solutions**:
```typescript
export const myStep = createStep(
  "my-step",
  async (input, { container }) => {
    const result = await service.create(input)
    // MUST return StepResponse with compensation data
    return new StepResponse(result, result.id)  // 2nd arg is compensation input
  },
  // Compensation function
  async (compensationData, { container }) => {
    // Guard against undefined
    if (!compensationData) return  // IMPORTANT!
    
    const service = container.resolve(MY_MODULE)
    await service.delete(compensationData)
  }
)
```

**Checklist**:
- [ ] Compensation function provided as 3rd argument
- [ ] `StepResponse(data, compensationData)` used
- [ ] Guard clause in compensation for undefined data
- [ ] Container resolution works in compensation

---

### Workflow times out

**Symptom**: `Workflow execution timeout` error

**Solutions**:
```typescript
// For long-running workflows, adjust config
module.exports = defineConfig({
  projectConfig: {
    workflowExecutionTimeout: 60000,  // 60 seconds (default: 15000)
  },
})
```

```typescript
// For distributed locking timeouts
acquireLockStep({
  key: input.resource_id,
  timeout: 10,  // Wait 10s for lock (default: 2)
  ttl: 60,      // Lock expires after 60s (default: 10)
})
```

---

### Variable manipulation error

**Symptom**: `Cannot manipulate variables directly` error

**Solution**:
```typescript
// ❌ WRONG - Cannot assign directly
const result = someStep()
const modified = { ...result, extra: "value" }  // ERROR!

// ✅ CORRECT - Use transform
import { transform } from "@medusajs/framework/workflows-sdk"

const result = someStep()
const modified = transform({ result }, ({ result }) => ({
  ...result,
  extra: "value"
}))
```

---

### Workflow not found

**Symptom**: `Workflow "xyz" not found` or cannot import

**Solutions**:
```typescript
// Ensure workflow file exports correctly
export const myWorkflow = createWorkflow(
  "my-workflow",  // This name must be unique!
  (input) => { ... }
)

// Import correctly
import { myWorkflow } from "../workflows/my-workflow"

// Execute correctly
const { result } = await myWorkflow(req.scope).run({ input })
```

---

## API Issues

### 401 Unauthorized

**Symptom**: API returns 401 even with valid token

**Solutions**:
```typescript
// 1. Check middleware configuration
// src/api/middlewares.ts
export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/my-route",
      middlewares: [
        authenticate("user", ["bearer", "session"]),
      ],
    },
  ],
})

// 2. For store routes, may need publishable key
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  // Check publishable key context
  if (!req.publishable_key_context?.sales_channel_ids.length) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Invalid publishable key"
    )
  }
}

// 3. Check JWT secret consistency
// .env must have JWT_SECRET set
// medusa-config.ts must use it
```

---

### Tenant isolation not working

**Symptom**: Users see data from other tenants

**Solutions**:
```typescript
// 1. Always filter by business_id in queries
const { data } = await query.graph({
  entity: "my_entity",
  fields: ["*"],
  filters: {
    business_id: req.auth_context?.actor_id,  // Or from tenant context
  },
})

// 2. Use middleware to inject tenant context
// src/api/middlewares.ts
{
  matcher: "/admin/*",
  middlewares: [
    async (req, res, next) => {
      const businessId = req.headers["x-business-id"]
      req.scope.register("tenantContext", {
        businessId,
      })
      next()
    },
  ],
}

// 3. In workflows, pass tenant ID in input
const { result } = await myWorkflow(req.scope).run({
  input: {
    ...req.validatedBody,
    business_id: req.auth_context?.actor_id,
  },
})
```

---

### Validation errors

**Symptom**: `Invalid request body` or validation fails

**Solutions**:
```typescript
// 1. Ensure middleware is applied
export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/my-resource",
      method: ["POST"],
      middlewares: [validateAndTransformBody(CreateSchema)],
    },
  ],
})

// 2. Check Zod schema
default import { z } from "@medusajs/framework/zod"

export const CreateSchema = z.object({
  name: z.string().min(1),  // Required
  email: z.string().email().optional(),  // Optional
  status: z.enum(["active", "inactive"]).default("active"),
})

// 3. Access validated body correctly
export const POST = async (
  req: MedusaRequest<z.infer<typeof CreateSchema>>,
  res: MedusaResponse
) => {
  const data = req.validatedBody  // Type-safe validated data
}
```

---

## Build Issues

### TypeScript errors

**Symptom**: Build fails with TS errors

**Common fixes**:
```typescript
// 1. Service generation types
// Add @ts-ignore for generated methods
class MyService extends MedusaService({ Entity }) {
  // @ts-ignore - Generated method
  async listEntities(...) { ... }
}

// 2. Workflow transform types
const transformed = transform(
  { input, data },
  (data): YourReturnType => ({  // Explicit return type
    ...data.input,
    computed: data.data.value
  })
)

// 3. MedusaRequest with custom body
import { z } from "@medusajs/framework/zod"
type CreateBody = z.infer<typeof CreateSchema>

export const POST = async (
  req: MedusaRequest<CreateBody>,
  res: MedusaResponse
) => { ... }
```

---

### Module not found

**Symptom**: `Cannot find module` errors

**Solutions**:
```bash
# 1. Rebuild after adding modules
npx medusa build

# 2. Clear cache
rm -rf node_modules/.cache
rm -rf dist

# 3. Reinstall dependencies
npm install

# 4. Check tsconfig.json paths
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## Performance Issues

### Slow queries

**Symptom**: API responses take >500ms

**Solutions**:
```typescript
// 1. Add database indexes
const Entity = model.define("entity", {
  business_id: model.text().index("IDX_BUSINESS"),
  status: model.text().index("IDX_STATUS"),
})
.indexes([
  { on: ["business_id", "status"] },  // Composite index
])

// 2. Use field selection
const { data } = await query.graph({
  entity: "product",
  fields: ["id", "title"],  // Only needed fields
  // NOT ["*"] for large entities
})

// 3. Add pagination
const { data, metadata } = await query.graph({
  entity: "order",
  fields: ["*"],
  pagination: {
    take: 20,
    skip: 0,
  },
})

// 4. Use caching (v2.11.0+)
const { data } = await query.graph(
  {
    entity: "product",
    fields: ["id", "title"],
  },
  {
    cache: {
      enable: true,
      ttl: 60,  // 60 seconds
    },
  }
)
```

---

### Memory issues

**Symptom**: Out of memory errors, high heap usage

**Solutions**:
```bash
# 1. Increase Node memory
node --max-old-space-size=4096 ./node_modules/.bin/medusa develop

# 2. Use streaming for large exports
// In API route
const stream = await service.getLargeDataStream()
res.setHeader('Content-Type', 'application/json')
stream.pipe(res)

# 3. Avoid loading all relations
// ❌ Bad
fields: ["*", "items.*", "items.product.*", "items.product.variants.*"]

// ✅ Better
fields: ["id", "items.id", "items.product.id"]
```

---

## Common Error Messages

### "Cannot resolve module"
```
Error: Cannot resolve module "myModule"
```
**Fix**: Ensure module is registered in `medusa-config.ts`

### "Workflow not found"
```
Error: Workflow "xyz" not found
```
**Fix**: Check workflow file is exported and imported correctly

### "Compensation failed"
```
Error: Compensation function failed
```
**Fix**: Add guard clause `if (!compensationData) return`

### "Entity not found in Query"
```
Error: Entity "xyz" was not found
```
**Fix**: Verify `entity` name matches `model.define()` first parameter

### "Link not found"
```
Error: Cannot find link for entity
```
**Fix**: Run `npx medusa db:sync-links`

---

## Debug Techniques

### Enable debug logging
```bash
# .env
LOG_LEVEL=debug
DEBUG=@medusajs:*
```

### Log workflow execution
```typescript
export const myStep = createStep(
  "my-step",
  async (input, { container }) => {
    const logger = container.resolve("logger")
    logger.debug(`Step input: ${JSON.stringify(input)}`)
    
    try {
      const result = await service.create(input)
      logger.debug(`Step result: ${JSON.stringify(result)}`)
      return new StepResponse(result, result.id)
    } catch (error) {
      logger.error(`Step failed: ${error.message}`)
      throw error
    }
  }
)
```

### Check loaded modules
```typescript
// In any API route
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const modules = req.scope.registrations
  res.json({ 
    loadedModules: Object.keys(modules).filter(k => k.includes('Module')) 
  })
}
```

---

## Useful Commands

```bash
# Development
npx medusa develop              # Start dev server
npx medusa build               # Production build
npx medusa start               # Start production

# Database
npx medusa db:setup            # Setup database
npx medusa db:migrate          # Run migrations
npx medusa db:generate         # Generate migrations
npx medusa db:rollback         # Rollback last migration
npx medusa db:sync-links       # Sync module links
npx medusa db:show-pending     # Show pending migrations

# Users
npx medusa user --email admin@example.com --password secret

# Cache
npx medusa cache:clear         # Clear Redis cache

# Check installation
npx medusa --version
```

---

## Getting Help

1. **Check logs** - Run with `LOG_LEVEL=debug`
2. **Search docs** - docs.medusajs.com
3. **GitHub issues** - github.com/medusajs/medusa
4. **Discord** - discord.gg/medusajs

---

## TheRxSpot-Specific Issues

### Business context not available
```typescript
// Ensure business_id is passed in workflow input
const { result } = await myWorkflow(req.scope).run({
  input: {
    ...req.validatedBody,
    business_id: req.headers["x-business-id"] || req.auth_context?.actor_id,
  },
})
```

### Consultation workflow fails
```typescript
// Check required fields in input
export type CreateConsultationInput = {
  patient_id: string      // Required
  business_id: string     // Required
  requested_date?: Date   // Optional
  notes?: string          // Optional
}
```

### Financial calculations incorrect
```typescript
// Use bigNumber for prices
import { BigNumber } from "@medusajs/framework/utils"

const earning = await service.createEarning({
  amount: new BigNumber(100.50),
  currency_code: "usd",
})
```
