# All Patterns Index

> **Quick Search Reference**: A-Z index of every pattern across Medusa V2 documentation.
> **Version**: Medusa V2.13.1
> **Scope**: Multi-tenant marketplace backend
> **Note**: Legacy `trimmed_part*.md` links were replaced with `LEGACY_SOURCE_MAP.md` to keep this index navigable.

---

## Quick Search Table

| Pattern | Category | Where Used | Link |
|---------|----------|------------|------|
| `acquireLockStep` | Workflow | Race condition prevention | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `actor_type` | Auth | Request context | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `addToCartWorkflow` | Core Workflow | Cart operations | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `additionalDataValidator` | API | Core route extension | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `array()` | Data Model | Array property | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `authenticate()` | Middleware | Route protection | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `AUTHENTICATE = false` | API | Opt-out auth | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `authMethodsPerActor` | Config | Provider restriction | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `belongsTo()` | Data Model | Relationship | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `bigNumber()` | Data Model | Price property | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `boolean()` | Data Model | Boolean property | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `cascades()` | Data Model | Delete cascade | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `cancelOrderWorkflow` | Core Workflow | Order management | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `completeCartWorkflow` | Core Workflow | Checkout | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `ContainerRegistrationKeys` | Container | DI resolution | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `createCartWorkflow` | Core Workflow | Cart creation | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `createCustomerWorkflow` | Core Workflow | Customer mgmt | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `createOrderWorkflow` | Core Workflow | Order creation | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `createProductsWorkflow` | Core Workflow | Product mgmt | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `createRemoteLinkStep` | Workflow | Module linking | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `createStep` | Workflow | Step definition | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `createWorkflow` | Workflow | Workflow definition | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `dateTime()` | Data Model | Timestamp | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `db:generate` | CLI | Migration | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `db:migrate` | CLI | Migration | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `db:sync-links` | CLI | Link sync | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `default()` | Data Model | Default value | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `defineLink` | Module | Cross-module link | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `defineMiddlewares` | API | Middleware config | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `defineRouteConfig` | Admin | UI route | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `defineWidgetConfig` | Admin | Widget | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `deleteCascade` | Link | Cascade delete | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `deleteLineItemsWorkflow` | Core Workflow | Cart operations | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `dismissRemoteLinkStep` | Workflow | Remove links | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `emitEventStep` | Workflow | Event emission | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `enum()` | Data Model | Enum property | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `entryPoint` | Link | Link table query | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `errorHandler` | API | Global error handling | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `fields` | Query | Field selection | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `filters` | Query | Filter records | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `float()` | Data Model | Decimal number | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `hasMany()` | Data Model | One-to-many | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `hasOne()` | Data Model | One-to-one | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `hooks.productsCreated` | Workflow | Workflow hooks | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `id()` | Data Model | ID property | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `index()` | Data Model | DB index | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `indexes()` | Data Model | Composite index | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `isList` | Link | Many relation | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `json()` | Data Model | JSON property | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `link.create()` | Link | Create link | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `link.dismiss()` | Link | Remove link | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `loader` | Module | Module loader | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `manyToMany()` | Data Model | Many-to-many | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `matcher` | Middleware | Route pattern | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `MedusaError` | Error | Error handling | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `MedusaService` | Service | CRUD generation | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `Module` | Module | Module definition | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `nullable()` | Data Model | Allow null | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `number()` | Data Model | Integer | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `pagination` | Query | Skip/take | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `primaryKey()` | Data Model | PK constraint | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `query.graph()` | Query | Data retrieval | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `query.index()` | Query | Cross-module filter | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `QueryContext` | Query | Context passing | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `readOnly` | Link | Virtual relation | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `releaseLockStep` | Workflow | Release lock | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `removeRemoteLinkStep` | Workflow | Remove links | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `runAsStep` | Workflow | Nested workflow | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `schedule` | Job | Cron expression | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `searchable()` | Data Model | Full-text search | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `sendNotificationsStep` | Workflow | Notifications | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `StepResponse` | Workflow | Step output | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `text()` | Data Model | String property | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `transform` | Workflow | Variable manipulation | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `unique()` | Data Model | Unique constraint | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `updateOrderWorkflow` | Core Workflow | Order update | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `updateProductsWorkflow` | Core Workflow | Product update | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `uploadFilesWorkflow` | Core Workflow | File upload | [CORE_WORKFLOWS.md](./CORE_WORKFLOWS.md) |
| `useQueryGraphStep` | Workflow | Query step | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `useRemoteQueryStep` | Workflow | Remote query | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `validateAndTransformBody` | Middleware | Body validation | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `validateAndTransformQuery` | Middleware | Query validation | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `when` | Workflow | Conditional execution | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `withDeleted` | Query | Include deleted | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |
| `WorkflowResponse` | Workflow | Workflow output | [LEGACY_SOURCE_MAP.md](./LEGACY_SOURCE_MAP.md) |

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

