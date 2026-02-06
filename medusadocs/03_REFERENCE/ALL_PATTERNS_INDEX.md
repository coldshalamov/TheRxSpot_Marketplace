# All Patterns Index

> **Quick Search Reference**: A-Z index of every pattern across Medusa V2 documentation.
> **Version**: Medusa V2.13.1
> **Scope**: Multi-tenant marketplace backend

---

## Quick Search Table

| Pattern | Category | Where Used | Link |
|---------|----------|------------|------|
| `acquireLockStep` | Workflow | Race condition prevention | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `actor_type` | Auth | Request context | [trimmed_part7.md](../trimmed_part7.md) |
| `addToCartWorkflow` | Core Workflow | Cart operations | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `additionalDataValidator` | API | Core route extension | [trimmed_part1.md](../trimmed_part1.md) |
| `array()` | Data Model | Array property | [trimmed_part1.md](../trimmed_part1.md) |
| `authenticate()` | Middleware | Route protection | [trimmed_part1.md](../trimmed_part1.md) |
| `AUTHENTICATE = false` | API | Opt-out auth | [trimmed_part1.md](../trimmed_part1.md) |
| `authMethodsPerActor` | Config | Provider restriction | [trimmed_part4.md](../trimmed_part4.md) |
| `belongsTo()` | Data Model | Relationship | [trimmed_part1.md](../trimmed_part1.md) |
| `bigNumber()` | Data Model | Price property | [trimmed_part1.md](../trimmed_part1.md) |
| `boolean()` | Data Model | Boolean property | [trimmed_part1.md](../trimmed_part1.md) |
| `cascades()` | Data Model | Delete cascade | [trimmed_part1.md](../trimmed_part1.md) |
| `cancelOrderWorkflow` | Core Workflow | Order management | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `completeCartWorkflow` | Core Workflow | Checkout | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `ContainerRegistrationKeys` | Container | DI resolution | [trimmed_part1.md](../trimmed_part1.md) |
| `createCartWorkflow` | Core Workflow | Cart creation | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `createCustomerWorkflow` | Core Workflow | Customer mgmt | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `createOrderWorkflow` | Core Workflow | Order creation | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `createProductsWorkflow` | Core Workflow | Product mgmt | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `createRemoteLinkStep` | Workflow | Module linking | [trimmed_part3.md](../trimmed_part3.md) |
| `createStep` | Workflow | Step definition | [trimmed_part1.md](../trimmed_part1.md) |
| `createWorkflow` | Workflow | Workflow definition | [trimmed_part1.md](../trimmed_part1.md) |
| `dateTime()` | Data Model | Timestamp | [trimmed_part1.md](../trimmed_part1.md) |
| `db:generate` | CLI | Migration | [trimmed_part1.md](../trimmed_part1.md) |
| `db:migrate` | CLI | Migration | [trimmed_part1.md](../trimmed_part1.md) |
| `db:sync-links` | CLI | Link sync | [trimmed_part1.md](../trimmed_part1.md) |
| `default()` | Data Model | Default value | [trimmed_part1.md](../trimmed_part1.md) |
| `defineLink` | Module | Cross-module link | [trimmed_part1.md](../trimmed_part1.md) |
| `defineMiddlewares` | API | Middleware config | [trimmed_part1.md](../trimmed_part1.md) |
| `defineRouteConfig` | Admin | UI route | [trimmed_part1.md](../trimmed_part1.md) |
| `defineWidgetConfig` | Admin | Widget | [trimmed_part1.md](../trimmed_part1.md) |
| `deleteCascade` | Link | Cascade delete | [trimmed_part5.md](../trimmed_part5.md) |
| `deleteLineItemsWorkflow` | Core Workflow | Cart operations | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `dismissRemoteLinkStep` | Workflow | Remove links | [trimmed_part3.md](../trimmed_part3.md) |
| `emitEventStep` | Workflow | Event emission | [trimmed_part1.md](../trimmed_part1.md) |
| `enum()` | Data Model | Enum property | [trimmed_part1.md](../trimmed_part1.md) |
| `entryPoint` | Link | Link table query | [trimmed_part2.md](../trimmed_part2.md) |
| `errorHandler` | API | Global error handling | [trimmed_part4.md](../trimmed_part4.md) |
| `fields` | Query | Field selection | [trimmed_part1.md](../trimmed_part1.md) |
| `filters` | Query | Filter records | [trimmed_part2.md](../trimmed_part2.md) |
| `float()` | Data Model | Decimal number | [trimmed_part1.md](../trimmed_part1.md) |
| `hasMany()` | Data Model | One-to-many | [trimmed_part1.md](../trimmed_part1.md) |
| `hasOne()` | Data Model | One-to-one | [trimmed_part4.md](../trimmed_part4.md) |
| `hooks.productsCreated` | Workflow | Workflow hooks | [trimmed_part1.md](../trimmed_part1.md) |
| `id()` | Data Model | ID property | [trimmed_part1.md](../trimmed_part1.md) |
| `index()` | Data Model | DB index | [trimmed_part1.md](../trimmed_part1.md) |
| `indexes()` | Data Model | Composite index | [trimmed_part4.md](../trimmed_part4.md) |
| `isList` | Link | Many relation | [trimmed_part1.md](../trimmed_part1.md) |
| `json()` | Data Model | JSON property | [trimmed_part1.md](../trimmed_part1.md) |
| `link.create()` | Link | Create link | [trimmed_part1.md](../trimmed_part1.md) |
| `link.dismiss()` | Link | Remove link | [trimmed_part1.md](../trimmed_part1.md) |
| `loader` | Module | Module loader | [trimmed_part1.md](../trimmed_part1.md) |
| `manyToMany()` | Data Model | Many-to-many | [trimmed_part1.md](../trimmed_part1.md) |
| `matcher` | Middleware | Route pattern | [trimmed_part1.md](../trimmed_part1.md) |
| `MedusaError` | Error | Error handling | [trimmed_part6.md](../trimmed_part6.md) |
| `MedusaService` | Service | CRUD generation | [trimmed_part1.md](../trimmed_part1.md) |
| `Module` | Module | Module definition | [trimmed_part1.md](../trimmed_part1.md) |
| `nullable()` | Data Model | Allow null | [trimmed_part1.md](../trimmed_part1.md) |
| `number()` | Data Model | Integer | [trimmed_part1.md](../trimmed_part1.md) |
| `pagination` | Query | Skip/take | [trimmed_part2.md](../trimmed_part2.md) |
| `primaryKey()` | Data Model | PK constraint | [trimmed_part1.md](../trimmed_part1.md) |
| `query.graph()` | Query | Data retrieval | [trimmed_part1.md](../trimmed_part1.md) |
| `query.index()` | Query | Cross-module filter | [trimmed_part5.md](../trimmed_part5.md) |
| `QueryContext` | Query | Context passing | [trimmed_part2.md](../trimmed_part2.md) |
| `readOnly` | Link | Virtual relation | [trimmed_part2.md](../trimmed_part2.md) |
| `releaseLockStep` | Workflow | Release lock | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `removeRemoteLinkStep` | Workflow | Remove links | [trimmed_part3.md](../trimmed_part3.md) |
| `runAsStep` | Workflow | Nested workflow | [trimmed_part4.md](../trimmed_part4.md) |
| `schedule` | Job | Cron expression | [trimmed_part1.md](../trimmed_part1.md) |
| `searchable()` | Data Model | Full-text search | [trimmed_part1.md](../trimmed_part1.md) |
| `sendNotificationsStep` | Workflow | Notifications | [trimmed_part6.md](../trimmed_part6.md) |
| `StepResponse` | Workflow | Step output | [trimmed_part1.md](../trimmed_part1.md) |
| `text()` | Data Model | String property | [trimmed_part1.md](../trimmed_part1.md) |
| `transform` | Workflow | Variable manipulation | [trimmed_part1.md](../trimmed_part1.md) |
| `unique()` | Data Model | Unique constraint | [trimmed_part1.md](../trimmed_part1.md) |
| `updateOrderWorkflow` | Core Workflow | Order update | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `updateProductsWorkflow` | Core Workflow | Product update | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `uploadFilesWorkflow` | Core Workflow | File upload | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `useQueryGraphStep` | Workflow | Query step | [trimmed_part1.md](../trimmed_part1.md) |
| `useRemoteQueryStep` | Workflow | Remote query | [trimmed_part3.md](../trimmed_part3.md) |
| `validateAndTransformBody` | Middleware | Body validation | [trimmed_part1.md](../trimmed_part1.md) |
| `validateAndTransformQuery` | Middleware | Query validation | [trimmed_part1.md](../trimmed_part1.md) |
| `when` | Workflow | Conditional execution | [trimmed_part1.md](../trimmed_part1.md) |
| `withDeleted` | Query | Include deleted | [trimmed_part2.md](../trimmed_part2.md) |
| `WorkflowResponse` | Workflow | Workflow output | [trimmed_part1.md](../trimmed_part1.md) |

---

## By Category

### Data Models

#### Property Types
| Type | Usage | Example |
|------|-------|---------|
| `model.id()` | Primary identifier | `id: model.id().primaryKey()` |
| `model.text()` | String | `name: model.text()` |
| `model.number()` | Integer | `count: model.number()` |
| `model.float()` | Decimal | `rating: model.float()` |
| `model.bigNumber()` | High-precision | `price: model.bigNumber()` |
| `model.boolean()` | Boolean | `isActive: model.boolean()` |
| `model.enum()` | Enumeration | `status: model.enum(["a", "b"])` |
| `model.dateTime()` | Timestamp | `createdAt: model.dateTime()` |
| `model.json()` | JSON object | `metadata: model.json()` |
| `model.array()` | String array | `tags: model.array()` |

#### Property Modifiers
| Modifier | Purpose | Example |
|----------|---------|---------|
| `.primaryKey()` | Set as PK | `model.id().primaryKey()` |
| `.nullable()` | Allow null | `description: model.text().nullable()` |
| `.default(value)` | Default value | `status: model.enum([...]).default("draft")` |
| `.unique()` | Unique constraint | `email: model.text().unique()` |
| `.index("name")` | DB index | `category: model.text().index("IDX_CAT")` |
| `.searchable()` | Full-text search | `title: model.text().searchable()` |

#### Relationship Patterns
| Type | Pattern | Direction |
|------|---------|-----------|
| One-to-One | `hasOne()` + `belongsTo()` | Bidirectional |
| One-to-Many | `hasMany()` + `belongsTo()` | Parent -> Child |
| Many-to-Many | `manyToMany()` + `manyToMany()` | Bidirectional |
| Read-Only | `field` + `readOnly: true` | Virtual |

#### Index Patterns
| Pattern | Usage |
|---------|-------|
| Single column | `field: model.text().index("IDX_NAME")` |
| Composite | `.indexes([{ on: ["a", "b"], unique: true }])` |
| Conditional | `.indexes([{ on: ["a"], where: { b: { $ne: null } } }])` |
| Cascade | `.cascades({ delete: ["children"] })` |

---

### Workflows

#### Step Patterns
| Pattern | Purpose |
|---------|---------|
| `createStep()` | Define workflow step |
| `StepResponse(data, compensationData)` | Return with rollback data |
| Compensation function | Rollback logic on failure |
| `.config({ name })` | Named step |

#### Execution Patterns
| Pattern | Usage |
|---------|-------|
| `createWorkflow()` | Define workflow |
| `workflow(container).run({ input })` | Execute in route/subscriber |
| `workflow.runAsStep({ input })` | Use as nested workflow |
| `when(condition).then(() => step)` | Conditional execution |

#### Compensation Patterns
| Pattern | Purpose |
|---------|---------|
| Step with compensation | `createStep(name, fn, compensationFn)` |
| Early return | `if (!compensationData) return` |
| Container resolve | Access services in compensation |

#### Variable Manipulation
| Pattern | Usage |
|---------|-------|
| `transform({ vars }, fn)` | Create/modify variables |
| Cannot assign directly | Must use transform |

---

### API Routes

#### Route Patterns
| Pattern | File | Description |
|---------|------|-------------|
| Store route | `src/api/store/*/route.ts` | Public API |
| Admin route | `src/api/admin/*/route.ts` | Protected API |
| Parameter | `src/api/store/[id]/route.ts` | Dynamic segment |
| Multiple methods | `GET`, `POST`, `PUT`, `DELETE` exports |

#### Middleware Patterns
| Pattern | Purpose |
|---------|---------|
| `defineMiddlewares({ routes: [...] })` | Configure middleware |
| `matcher: "/pattern/*"` | Route matching |
| `methods: ["POST", "PUT"]` | HTTP method filter |
| `authenticate(type, methods)` | Auth requirement |

#### Validation Patterns
| Pattern | Usage |
|---------|-------|
| `validateAndTransformBody(Schema)` | Body validation |
| `validateAndTransformQuery(Schema, config)` | Query validation |
| `z.object({...})` | Zod schema |
| `createFindParams()` | Default query params |
| `req.validatedBody` | Access validated data |
| `req.queryConfig` | Query configuration |

---

### Security

#### Auth Patterns
| Pattern | Usage |
|---------|-------|
| `authenticate("user", ["bearer", "session"])` | Admin auth |
| `authenticate("customer", ["bearer"])` | Customer auth |
| `allowUnregistered: true` | Allow pending registration |
| `req.auth_context.actor_id` | Get user ID |
| `req.auth_context.actor_type` | Get actor type |

#### Encryption Patterns
| Pattern | Usage |
|---------|-------|
| `jwtSecret` | JWT signing |
| `jwtPublicKey` | JWT verification |
| `cookieSecret` | Cookie signing |
| RS256 algorithm | Asymmetric encryption |

#### Audit Patterns
| Pattern | Usage |
|---------|-------|
| Emit event on change | `emitEventStep({ eventName, data })` |
| Subscriber logging | `logger.info()` in handler |
| `metadata` field | Store change context |

---

## Filter Operators Reference

| Operator | Description | Example |
|----------|-------------|---------|
| `$ne` | Not equal | `{ status: { $ne: "deleted" } }` |
| `$nin` | Not in array | `{ type: { $nin: ["a", "b"] } }` |
| `$gt` | Greater than | `{ price: { $gt: 100 } }` |
| `$gte` | Greater than or equal | `{ age: { $gte: 18 } }` |
| `$lt` | Less than | `{ created_at: { $lt: date } }` |
| `$lte` | Less than or equal | `{ stock: { $lte: 10 } }` |
| `$like` | Pattern match | `{ name: { $like: "%search%" } }` |
| `$or` | OR condition | `{ $or: [{ a: 1 }, { b: 2 }] }` |

---

## Container Keys Reference

| Key | Service | Registration Key |
|-----|---------|------------------|
| `query` | Query API | `ContainerRegistrationKeys.QUERY` |
| `link` | Link API | N/A |
| `logger` | Logger | `ContainerRegistrationKeys.LOGGER` |
| `eventBus` | Event Bus | `ContainerRegistrationKeys.EVENT_BUS` |
| `Modules.PRODUCT` | Product Service | `@medusajs/medusa/product` |
| `Modules.CUSTOMER` | Customer Service | `@medusajs/medusa/customer` |
| `Modules.ORDER` | Order Service | `@medusajs/medusa/order` |

---

## File Structure Patterns

```
src/
├── modules/
│   └── my-module/
│       ├── models/
│       │   └── my-entity.ts
│       ├── migrations/
│       │   └── Migration-*.ts
│       ├── service.ts
│       └── index.ts
├── workflows/
│   ├── my-workflow.ts
│   └── steps/
│       └── my-step.ts
├── api/
│   ├── middlewares.ts
│   ├── store/
│   │   └── my-resource/
│   │       └── route.ts
│   └── admin/
│       └── my-resource/
│           ├── route.ts
│           └── [id]/
│               └── route.ts
├── links/
│   └── my-entity-product.ts
├── subscribers/
│   └── my-event-handler.ts
├── jobs/
│   └── my-scheduled-job.ts
└── admin/
    ├── lib/
    │   └── sdk.ts
    ├── routes/
    │   └── my-page/
    │       └── page.tsx
    └── widgets/
        └── my-widget.tsx
```

---

## Essential Imports Cheat Sheet

```typescript
// Framework
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaService, Module, defineLink } from "@medusajs/framework/utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaError } from "@medusajs/framework/utils"
import { model } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

// Workflows
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { transform, when } from "@medusajs/framework/workflows-sdk"

// Admin
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { defineWidgetConfig } from "@medusajs/admin-sdk"

// Core flows
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
```
