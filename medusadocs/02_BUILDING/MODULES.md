# Building Custom Modules

## TL;DR (Quick Reference)

**Decision Tree:**
```
Creating a new module?
├── 1. Create model in src/modules/{name}/models/{entity}.ts
├── 2. Create service in src/modules/{name}/service.ts (extend MedusaService)
├── 3. Create module export in src/modules/{name}/index.ts
├── 4. Register in medusa-config.ts
├── 5. Run: npx medusa db:generate {name}
└── 6. Run: npx medusa db:migrate
```

**Copy-paste template:**
```typescript
// src/modules/blog/models/post.ts
import { model } from "@medusajs/framework/utils"

const Post = model.define("post", {
  id: model.id().primaryKey(),
  title: model.text(),
  content: model.text().nullable(),
  status: model.enum(["draft", "published"]).default("draft"),
  business_id: model.text(), // For multi-tenant
})

export default Post
```

```typescript
// src/modules/blog/service.ts
import { MedusaService } from "@medusajs/framework/utils"
import Post from "./models/post"

class BlogModuleService extends MedusaService({ Post }) {
  // Custom methods here
  async listPublished() {
    return this.listPosts({ status: "published" })
  }
}

export default BlogModuleService
```

```typescript
// src/modules/blog/index.ts
import { Module } from "@medusajs/framework/utils"
import BlogModuleService from "./service"

export const BLOG_MODULE = "blogModuleService"

export default Module(BLOG_MODULE, { service: BlogModuleService })
```

```typescript
// medusa-config.ts
modules: {
  blogModuleService: {
    resolve: "./src/modules/blog",
    definition: { isQueryable: true }
  }
}
```

---

## Module Structure Overview

```
src/modules/{module-name}/
├── index.ts              # Module definition - exports the module
├── service.ts            # Main service class - business logic
├── models/               # Data models (DML)
│   ├── index.ts          # Re-export all models
│   └── {entity}.ts       # Individual model definitions
├── migrations/           # Database migrations
│   └── Migration*.ts     # Auto-generated + custom migrations
└── types.ts              # (Optional) Shared TypeScript types
```

### What Each File Does

| File | Purpose | Key Exports |
|------|---------|-------------|
| `index.ts` | Module registration | Module constant, Module() call |
| `service.ts` | Business logic | Service class extending MedusaService |
| `models/*.ts` | Data structure | DML model definitions |
| `migrations/*.ts` | Schema changes | MikroORM migration classes |

---

## Creating a Module - Step by Step

### 1. Data Model

#### DML Syntax (Data Modeling Language)

Medusa V2 uses DML instead of raw SQL or TypeORM. Define models with the `model.define()` function:

```typescript
// src/modules/business/models/business.ts
import { model } from "@medusajs/framework/utils"

export const Business = model.define("business", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text().unique(),
  contact_email: model.text().nullable(),
  is_active: model.boolean().default(true),
  status: model.enum(["pending", "approved", "active", "suspended"]).default("pending"),
  branding_config: model.json().default({}),
  domain: model.text().unique().nullable(),
  sales_channel_id: model.text().nullable(),
})
```

#### Property Types

| Type | Usage | Example |
|------|-------|---------|
| `model.id()` | Primary key (auto-generated) | `id: model.id().primaryKey()` |
| `model.text()` | String values | `name: model.text()` |
| `model.number()` | Integer values | `count: model.number()` |
| `model.float()` | Decimal numbers | `rating: model.float()` |
| `model.bigNumber()` | High-precision (prices) | `price: model.bigNumber()` |
| `model.boolean()` | True/false | `is_active: model.boolean()` |
| `model.enum()` | Fixed set of values | `status: model.enum(["a", "b"])` |
| `model.dateTime()` | Timestamps | `created_at: model.dateTime()` |
| `model.json()` | JSON objects | `metadata: model.json()` |
| `model.array()` | Array of strings | `tags: model.array()` |

#### Property Modifiers

```typescript
const Product = model.define("product", {
  id: model.id().primaryKey(),
  
  // Default value
  status: model.enum(["draft", "published"]).default("draft"),
  
  // Nullable (allows null)
  description: model.text().nullable(),
  
  // Unique constraint
  sku: model.text().unique(),
  
  // Database index
  category_id: model.text().index("IDX_PRODUCT_CATEGORY"),
  
  // Full-text searchable
  name: model.text().searchable(),
})
```

#### Relationships

**One-to-Many (within same module):**
```typescript
// Parent side
const Store = model.define("store", {
  id: model.id().primaryKey(),
  products: model.hasMany(() => Product, { mappedBy: "store" }),
})

// Child side
const Product = model.define("product", {
  id: model.id().primaryKey(),
  store: model.belongsTo(() => Store, { mappedBy: "products" }),
  store_id: model.text(), // Foreign key stored explicitly
})
```

**Many-to-Many:**
```typescript
const Order = model.define("order", {
  id: model.id().primaryKey(),
  products: model.manyToMany(() => Product, { 
    mappedBy: "orders",
    pivotTable: "order_product",
    joinColumn: "order_id",
    inverseJoinColumn: "product_id",
  }),
})

const Product = model.define("product", {
  id: model.id().primaryKey(),
  orders: model.manyToMany(() => Order, { mappedBy: "products" }),
})
```

**Cascade Delete:**
```typescript
const Store = model.define("store", {
  id: model.id().primaryKey(),
  products: model.hasMany(() => Product, { mappedBy: "store" }),
})
.cascades({
  delete: ["products"], // Delete products when store is deleted
})
```

**Composite Indexes:**
```typescript
const MyModel = model.define("my_model", {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  external_id: model.text(),
})
.indexes([
  {
    on: ["tenant_id", "external_id"],
    unique: true, // Composite unique constraint
  },
])
```

#### Business-Scoping Pattern (Multi-Tenant)

Every entity in this marketplace must be scoped to a business:

```typescript
// src/modules/business/models/location.ts
export const Location = model.define("location", {
  id: model.id().primaryKey(),
  business_id: model.text(), // REQUIRED - tenant scope
  name: model.text(),
  phone: model.text(),
  email: model.text().nullable(),
  address: model.text().nullable(),
  is_active: model.boolean().default(true),
})
```

**Rules for business-scoped entities:**
1. Always include `business_id: model.text()` (not nullable)
2. Add indexes on `business_id` for query performance
3. Filter by `business_id` in all list queries

---

### 2. Service

#### Extending MedusaService

The `MedusaService` factory auto-generates CRUD methods:

```typescript
// src/modules/business/service.ts
import { MedusaService } from "@medusajs/framework/utils"
import { Business } from "./models/business"
import { Location } from "./models/location"

class BusinessModuleService extends MedusaService({
  Business,
  Location,
  // Add all models here
}) {
  // Custom methods go here
}

export default BusinessModuleService
```

**Auto-generated methods for each model:**

| Operation | Method | Example |
|-----------|--------|---------|
| Create (single) | `createBusiness` | `createBusiness({ name: "X" })` |
| Create (batch) | `createBusinesses` | `createBusinesses([{...}, {...}])` |
| List | `listBusinesses` | `listBusinesses(filters, config)` |
| List + Count | `listAndCountBusinesses` | Returns `[data, count]` |
| Retrieve | `retrieveBusiness` | `retrieveBusiness(id, config)` |
| Update (single) | `updateBusiness` | `updateBusiness({ id, ...data })` |
| Update (batch) | `updateBusinesses` | `updateBusinesses([{ id, ... }])` |
| Delete | `deleteBusinesses` | `deleteBusinesses(idOrIds)` |
| Soft Delete | `softDeleteBusinesses` | `softDeleteBusinesses(idOrIds)` |
| Restore | `restoreBusinesses` | `restoreBusinesses(idOrIds)` |

#### Custom Methods

```typescript
class BusinessModuleService extends MedusaService({
  Business,
  Location,
}) {
  // Custom query with filters
  async getBusinessBySlug(slug: string) {
    const businesses = await this.listBusinesses({ slug }, { take: 1 })
    return businesses[0] ?? null
  }

  // Multi-tenant aware list
  async listActiveBusinesses() {
    return await this.listBusinesses(
      { is_active: true },
      { order: { name: "ASC" } }
    )
  }

  // Business logic with validation
  async activateBusiness(businessId: string) {
    const business = await this.retrieveBusiness(businessId)
    
    if (business.status === "active") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Business is already active"
      )
    }
    
    return await this.updateBusinesses({
      id: businessId,
      status: "active",
    })
  }

  // Cross-entity operation
  async listLocationsByBusiness(businessId: string) {
    return await this.listLocations(
      { business_id: businessId },
      { order: { name: "ASC" } }
    )
  }
}
```

#### Injecting Dependencies

```typescript
import { MedusaService } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { Business } from "./models/business"

type InjectedDependencies = {
  logger: Logger
}

class BusinessModuleService extends MedusaService({ Business }) {
  private logger: Logger

  constructor({ logger }: InjectedDependencies) {
    super(...arguments)
    this.logger = logger
  }

  async doSomething() {
    this.logger.info("Doing something...")
  }
}
```

#### Querying Within Services

```typescript
import { MedusaService } from "@medusajs/framework/utils"
import { Business } from "./models/business"

class BusinessModuleService extends MedusaService({ Business }) {
  // Use inherited methods for simple queries
  async findBySlug(slug: string) {
    const results = await this.listBusinesses({ slug }, { take: 1 })
    return results[0] ?? null
  }

  // Complex queries with ordering
  async listRecent(limit: number = 10) {
    return await this.listBusinesses(
      {},
      { 
        order: { created_at: "DESC" },
        take: limit,
      }
    )
  }

  // Retrieve with relations (if using MikroORM directly)
  async findWithDetails(id: string) {
    return await this.retrieveBusiness(id, {
      relations: ["locations"], // If Location is in same module with relationship
    })
  }
}
```

---

### 3. Module Definition

#### Export Pattern

```typescript
// src/modules/business/index.ts
import { Module } from "@medusajs/framework/utils"
import BusinessModuleService from "./service"

// Export the module name constant for resolution
export const BUSINESS_MODULE = "businessModuleService"

export default Module(BUSINESS_MODULE, {
  service: BusinessModuleService,
})
```

#### Registration in medusa-config.ts

```typescript
// medusa-config.ts
import { defineConfig } from "@medusajs/framework/utils"

module.exports = defineConfig({
  projectConfig: {
    // ... your config
  },
  modules: {
    // Register custom modules
    businessModuleService: {
      resolve: "./src/modules/business",
      definition: {
        isQueryable: true // Enable Query API for this module
      }
    },
    consultationModuleService: {
      resolve: "./src/modules/consultation",
      definition: { isQueryable: true }
    },
    financialsModuleService: {
      resolve: "./src/modules/financials",
      definition: { isQueryable: true }
    },
    complianceModuleService: {
      resolve: "./src/modules/compliance",
      definition: { isQueryable: true }
    },
  },
})
```

**Important:** Module keys in the config (e.g., `businessModuleService`) must match the constant used in `Module()` and when resolving from the container.

---

### 4. Migrations

#### Generating Migrations

After modifying your DML models, generate migrations:

```bash
# Generate migration for a specific module
npx medusa db:generate business

# Generate for all modules
npx medusa db:generate
```

This creates files like:
```
src/modules/business/migrations/Migration20260205080000.ts
```

#### Running Migrations

```bash
# Run pending migrations
npx medusa db:migrate

# Check migration status
npx medusa db:pending

# Rollback last migration (use with caution)
npx medusa db:rollback business
```

#### Custom Migrations

Sometimes you need custom SQL migrations (e.g., for indexes, constraints):

```typescript
// src/modules/business/migrations/Migration20260205080000.ts
import { Migration } from '@mikro-orm/migrations';

export class Migration20260205080000 extends Migration {

  async up(): Promise<void> {
    // Create table with explicit SQL
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "order_status_event" (
        "id" TEXT PRIMARY KEY,
        "order_id" TEXT NOT NULL,
        "business_id" TEXT NOT NULL,
        "from_status" TEXT NOT NULL,
        "to_status" TEXT NOT NULL,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add indexes
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_status_event_order_id" ON "order_status_event" ("order_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_status_event_business_id" ON "order_status_event" ("business_id")`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "order_status_event"`);
  }

}
```

---

## Patterns

### Pattern: Tenant-Scoped Entity

All entities in a multi-tenant system must include `business_id`:

```typescript
// src/modules/business/models/coupon.ts
import { model } from "@medusajs/framework/utils"

export const Coupon = model.define("coupon", {
  id: model.id().primaryKey(),
  business_id: model.text(), // Tenant scope
  code: model.text(),
  discount_type: model.enum(["percentage", "fixed"]),
  discount_value: model.bigNumber(),
  is_active: model.boolean().default(true),
  usage_limit: model.number().nullable(),
  usage_count: model.number().default(0),
  starts_at: model.dateTime().nullable(),
  ends_at: model.dateTime().nullable(),
})
```

**Service implementation with business scoping:**

```typescript
class BusinessModuleService extends MedusaService({ Coupon }) {
  // Always filter by business_id
  async listCouponsByBusiness(businessId: string) {
    return await this.listCoupons(
      { business_id: businessId },
      { order: { created_at: "DESC" } }
    )
  }

  // Validate coupon belongs to business
  async validateCoupon(businessId: string, code: string) {
    const coupons = await this.listCoupons(
      { business_id: businessId, code: code.toUpperCase() },
      { take: 1 }
    )
    return coupons[0] ?? null
  }
}
```

---

### Pattern: Linking to Medusa Core Entities

Use Module Links to connect custom entities to Medusa core entities:

```typescript
// src/links/business-sales-channel.ts
import { defineLink } from "@medusajs/framework/utils"
import BusinessModule from "../modules/business"
import { Modules } from "@medusajs/framework/utils"

export default defineLink(
  {
    linkable: BusinessModule.linkable.business,
    field: "sales_channel_id", // Field on business that stores the FK
  },
  Modules.SalesChannel.linkable.salesChannel,
  {
    readOnly: true, // No link table created - just for querying
  }
)
```

Query with the link:
```typescript
const { data: businesses } = await query.graph({
  entity: "business",
  fields: ["*", "sales_channel.*"], // Follow the link
  filters: { id: businessId },
})
```

---

### Pattern: Soft Delete with Restore

MedusaService provides soft delete methods:

```typescript
// Model - no special config needed
const Product = model.define("product", {
  id: model.id().primaryKey(),
  name: model.text(),
  deleted_at: model.dateTime().nullable(), // Auto-managed
})

// Service usage
class ProductService extends MedusaService({ Product }) {
  async archiveProduct(id: string) {
    // Soft delete - sets deleted_at
    return await this.softDeleteProducts(id)
  }

  async restoreProduct(id: string) {
    // Restore - clears deleted_at
    return await this.restoreProducts(id)
  }

  async listActive() {
    // Soft-deleted items are automatically excluded
    return await this.listProducts({})
  }

  async listAllIncludingDeleted() {
    // Include soft-deleted with filter
    return await this.listProducts(
      {},
      { withDeleted: true }
    )
  }
}
```

---

### Pattern: Encrypted PHI Fields

For HIPAA compliance, encrypt sensitive fields at the service layer:

```typescript
// src/modules/business/service.ts
import { MedusaService } from "@medusajs/framework/utils"
import { ConsultSubmission } from "./models/consult-submission"
import { encryptFields, decryptFields } from "../../utils/encryption"

class BusinessModuleService extends MedusaService({
  ConsultSubmission,
}) {
  // Define which fields contain PHI
  private static readonly PHI_FIELDS = [
    "customer_email",
    "customer_first_name",
    "customer_last_name",
    "customer_phone",
    "customer_dob",
    "eligibility_answers",
    "chief_complaint",
    "medical_history",
    "notes",
  ] as const

  // Override create to encrypt
  async createConsultSubmission(input: Record<string, any>): Promise<any> {
    const isEnabled = process.env.PHI_ENCRYPTION_ENABLED === "true"
    
    if (!isEnabled) {
      return await this.createConsultSubmissions(input)
    }

    // Encrypt PHI fields before saving
    const encrypted = encryptFields(input, BusinessModuleService.PHI_FIELDS)
    const created = await this.createConsultSubmissions(encrypted)
    
    // Return decrypted for convenience
    return decryptFields(created, BusinessModuleService.PHI_FIELDS)
  }

  // Override list to decrypt
  async listConsultSubmissionsDecrypted(
    filters: any = {},
    config: any = {}
  ): Promise<any[]> {
    const list = await this.listConsultSubmissions(filters, config)
    
    if (process.env.PHI_ENCRYPTION_ENABLED !== "true") {
      return list
    }

    return list.map((s) =>
      decryptFields(s, BusinessModuleService.PHI_FIELDS)
    )
  }

  // Override retrieve to decrypt
  async retrieveConsultSubmissionDecrypted(
    id: string,
    config?: any
  ): Promise<any> {
    const submission = await this.retrieveConsultSubmission(id, config)
    
    if (process.env.PHI_ENCRYPTION_ENABLED !== "true") {
      return submission
    }

    return decryptFields(submission, BusinessModuleService.PHI_FIELDS)
  }
}
```

**Encryption utility (`src/utils/encryption.ts`):**
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

export function encryptString(plaintext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY_CURRENT!, "hex")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`
}

export function decryptString(payload: string): string {
  const [, ivHex, tagHex, cipherHex] = payload.split(":")
  const key = Buffer.from(process.env.ENCRYPTION_KEY_CURRENT!, "hex")
  
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  
  return Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final()
  ]).toString("utf8")
}

export function encryptFields<T extends Record<string, any>>(
  input: T,
  fields: readonly (keyof T)[]
): T {
  const out = { ...input }
  for (const field of fields) {
    const value = out[field]
    if (value === null || value === undefined) continue
    out[field] = encryptString(String(value)) as any
  }
  return out
}

export function decryptFields<T extends Record<string, any>>(
  input: T,
  fields: readonly (keyof T)[]
): T {
  const out = { ...input }
  for (const field of fields) {
    const value = out[field]
    if (typeof value !== "string" || !value.startsWith("v1:")) continue
    out[field] = decryptString(value) as any
  }
  return out
}
```

---

## Reference

### All DML Property Types

```typescript
// ID (auto-generated string like "biz_123456789")
id: model.id().primaryKey()

// Text (VARCHAR/TEXT)
name: model.text()
description: model.text().nullable()

// Number (INTEGER)
quantity: model.number()
quantity: model.number().default(0)

// Float (DOUBLE/REAL)
rating: model.float()
rating: model.float().default(5.0)

// BigNumber (for prices/currency)
price: model.bigNumber()
total: model.bigNumber().nullable()

// Boolean
is_active: model.boolean()
is_active: model.boolean().default(true)

// Enum
status: model.enum(["pending", "active", "archived"])
status: model.enum(["pending", "active"]).default("pending")

// DateTime
created_at: model.dateTime()
expires_at: model.dateTime().nullable()

// JSON (stored as JSONB in Postgres)
metadata: model.json()
metadata: model.json().default({})
metadata: model.json().nullable()

// Array (text array)
tags: model.array()
tags: model.array().default([])
```

### Relationship Types

```typescript
// One-to-One
profile: model.hasOne(() => Profile, { mappedBy: "user" })
user: model.belongsTo(() => User, { mappedBy: "profile" })

// One-to-Many
posts: model.hasMany(() => Post, { mappedBy: "author" })
author: model.belongsTo(() => Author, { mappedBy: "posts" })

// Many-to-Many
tags: model.manyToMany(() => Tag, { mappedBy: "products" })
products: model.manyToMany(() => Product, { 
  mappedBy: "tags",
  pivotTable: "product_tag",
  joinColumn: "product_id",
  inverseJoinColumn: "tag_id",
})
```

### Service Methods Auto-Generated

For a model named `Business`, these methods are auto-generated:

| Method | Signature |
|--------|-----------|
| `createBusiness` | `(data: CreateBusinessDTO) => Promise<Business>` |
| `createBusinesses` | `(data: CreateBusinessDTO[]) => Promise<Business[]>` |
| `listBusinesses` | `(filters?, config?) => Promise<Business[]>` |
| `listAndCountBusinesses` | `(filters?, config?) => Promise<[Business[], number]>` |
| `retrieveBusiness` | `(id: string, config?) => Promise<Business>` |
| `updateBusiness` | `(data: UpdateBusinessDTO) => Promise<Business>` |
| `updateBusinesses` | `(data: UpdateBusinessDTO[]) => Promise<Business[]>` |
| `deleteBusinesses` | `(ids: string \| string[]) => Promise<void>` |
| `softDeleteBusinesses` | `(ids: string \| string[]) => Promise<void>` |
| `restoreBusinesses` | `(ids: string \| string[]) => Promise<void>` |

**Config options for list/retrieve:**
```typescript
{
  select?: string[]           // Fields to select
  relations?: string[]        // Relations to load
  order?: { [field]: "ASC" \| "DESC" }
  take?: number               // Limit (page size)
  skip?: number               // Offset
  withDeleted?: boolean       // Include soft-deleted
}
```

### Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Module not found` | Module not registered in medusa-config.ts | Add to `modules` object in config |
| `Service method undefined` | Model not passed to MedusaService | Add model to `MedusaService({ ... })` |
| `Migration fails` | Manual SQL errors | Check SQL syntax; ensure proper escaping |
| `Query returns empty` | Soft delete filter | Use `withDeleted: true` if needed |
| `Cannot resolve dependency` | Missing injection | Add to constructor dependencies |
| `Link not working` | Links not synced | Run `npx medusa db:sync-links` |
| `Encryption fails` | Missing ENCRYPTION_KEY_CURRENT | Set 32-byte hex key in env |
| `Duplicate key` | Unique constraint violation | Check for existing records first |

### Key CLI Commands

```bash
# Development
npx medusa develop                 # Start dev server with hot reload
npx medusa build                   # Production build

# Database
npx medusa db:generate {module}    # Generate migration from DML changes
npx medusa db:migrate              # Run pending migrations
npx medusa db:rollback {module}    # Rollback last migration
npx medusa db:sync-links           # Sync module links
npx medusa db:pending              # Show pending migrations

# Utility
npx medusa user --email ...        # Create admin user
```

### File Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Module folder | kebab-case | `business`, `consultation` |
| Model files | kebab-case | `consult-submission.ts` |
| Model exports | PascalCase | `ConsultSubmission` |
| Service file | `service.ts` | `service.ts` |
| Service class | PascalCase + ModuleService | `BusinessModuleService` |
| Module constant | UPPER_SNAKE_CASE | `BUSINESS_MODULE` |
| Migration files | PascalCase with timestamp | `Migration20260205080000.ts` |

---

*Reference for Medusa V2.13.1 - Multi-tenant marketplace patterns*
