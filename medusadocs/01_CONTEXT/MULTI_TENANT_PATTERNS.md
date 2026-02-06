# Medusa Marketplace Recipe - Architectural Patterns Reference

> Extracted from Medusa Marketplace Recipe for TheRxSpot Marketplace (Medusa V2 Multi-tenant Healthcare Platform)

---

## Architecture Overview

### Core Pattern: Module-Based Multi-tenancy

Medusa's marketplace pattern uses **custom modules** to implement multi-tenancy without native marketplace support:

```
┌─────────────────────────────────────────────────────────────┐
│                    Medusa Core Modules                       │
│  (Product, Order, Cart, Customer, SalesChannel, etc.)       │
└───────────────────────────┬─────────────────────────────────┘
                            │ Links (Module Links)
┌───────────────────────────▼─────────────────────────────────┐
│               Custom Marketplace Module                      │
│  ┌──────────────┐  ┌─────────────────┐                      │
│  │   Vendor     │──│   VendorAdmin   │                      │
│  │  (Tenant)    │  │  (Actor Type)   │                      │
│  └──────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle**: Modules remain isolated; cross-module relationships are defined via **Module Links** (not direct relations).

---

## Data Model Patterns

### 1. Tenant Entity Pattern

The `Vendor` (or `Business`/`Restaurant`) serves as the tenant container:

```typescript
// Core tenant entity
const Vendor = model.define("vendor", {
  id: model.id().primaryKey(),
  handle: model.text().unique(),  // URL-friendly identifier
  name: model.text(),
  logo: model.text().nullable(),
  // Relationship to tenant admins
  admins: model.hasMany(() => VendorAdmin, {
    mappedBy: "vendor",
  }),
})
```

**Fields to consider for healthcare variant**:
- `handle`: Unique identifier for URL routing (e.g., `pharmacy-name`)
- `logo` → `branding_assets`: Healthcare provider logos/branding
- Add: `status` (active/inactive), `verification_status`, `license_number`

### 2. Tenant Admin Pattern (Custom Actor Type)

Vendor admins are **custom actor types** with their own authentication flow:

```typescript
const VendorAdmin = model.define("vendor_admin", {
  id: model.id().primaryKey(),
  first_name: model.text().nullable(),
  last_name: model.text().nullable(),
  email: model.text().unique(),
  // Belongs to exactly one vendor (tenant)
  vendor: model.belongsTo(() => Vendor, {
    mappedBy: "admins",
  }),
})
```

**Key insight**: Each vendor admin is scoped to exactly ONE vendor via the `belongsTo` relation.

### 3. Module Link Pattern (Cross-Module Associations)

Links connect tenant entities to Medusa core entities:

```typescript
// Vendor <-> Product Link
export default defineLink(
  MarketplaceModule.linkable.vendor,
  {
    linkable: ProductModule.linkable.product.id,
    isList: true,  // One vendor has many products
  }
)

// Vendor <-> Order Link  
export default defineLink(
  MarketplaceModule.linkable.vendor,
  {
    linkable: OrderModule.linkable.order.id,
    isList: true,  // One vendor has many orders
  }
)
```

**Pattern**: Links are stored in pivot tables, maintaining module isolation.

### 4. Multi-Actor Type Authentication Model

The recipe demonstrates multiple custom actor types coexisting:

| Actor Type | Purpose | Module |
|------------|---------|--------|
| `vendor` / `restaurant` | Tenant admin users | Marketplace/Restaurant Module |
| `driver` | Delivery personnel | Delivery Module |
| `customer` | Default customer | Customer Module (built-in) |
| `admin` | Platform super admin | User Module (built-in) |

---

## Authorization Patterns

### 1. Custom Actor Type Authentication Flow

Three-step process for custom user types:

```
Step 1: Registration Token
POST /auth/{actor_type}/emailpass/register
→ Returns registration JWT token

Step 2: Create User  
POST /vendors (or /users)
Headers: Authorization: Bearer {registration_token}
Body: { user_data }
→ Creates user + links to auth_identity via setAuthAppMetadataStep

Step 3: Authenticated Token
POST /auth/{actor_type}/emailpass
→ Returns authenticated JWT token for subsequent requests
```

### 2. Actor Type Enforcement via Middleware

```typescript
// src/api/middlewares.ts
export default defineMiddlewares({
  routes: [
    {
      matcher: "/vendors",
      method: ["POST"],
      middlewares: [
        // Registration: allow unregistered users
        authenticate("vendor", ["session", "bearer"], {
          allowUnregistered: true,
        }),
      ],
    },
    {
      matcher: "/vendors/*",
      middlewares: [
        // All other routes: require registered vendor admin
        authenticate("vendor", ["session", "bearer"]),
      ],
    },
  ],
})
```

### 3. Tenant-Scoped Access Control

Custom middleware enforces tenant-scoped access:

```typescript
// Pattern: Verify admin belongs to the tenant being accessed
export const isDeliveryRestaurant = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  // 1. Get current user's vendor
  const restaurantAdmin = await restaurantModuleService.retrieveRestaurantAdmin(
    req.auth_context.actor_id,
    { relations: ["restaurant"] }
  )

  // 2. Get resource's vendor via Query
  const { data: [delivery] } = await query.graph({
    entity: "delivery",
    fields: ["restaurant.*"],
    filters: { id: req.params.id },
  })

  // 3. Enforce match
  if (delivery.restaurant?.id !== restaurantAdmin.restaurant.id) {
    return res.status(403).json({ message: "unauthorized" })
  }

  next()
}
```

**Apply to routes**:
```typescript
{
  matcher: "/deliveries/:id/accept",
  middlewares: [
    authenticate("restaurant", "bearer"),  // Actor type check
    isDeliveryRestaurant,                   // Tenant scope check
  ],
}
```

### 4. Resource-Level Authorization

For driver-scoped resources (user must own the resource):

```typescript
export const isDeliveryDriver = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const delivery = await deliveryModuleService.retrieveDelivery(
    req.params.id,
    { relations: ["driver"] }
  )

  if (delivery.driver.id !== req.auth_context.actor_id) {
    return res.status(403).json({ message: "unauthorized" })
  }

  next()
}
```

---

## Key Workflows

### 1. Vendor/User Creation Workflow

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────────────┐
│  createVendor   │────▶│ createVendorAdmin   │────▶│ setAuthAppMetadataStep  │
│     Step        │     │      Step           │     │  (link to auth identity)│
└─────────────────┘     └─────────────────────┘     └─────────────────────────┘
        │                                              │
        ▼                                              ▼
   Creates vendor                              Links vendor_admin.id
   record in DB                                 to auth identity
```

**Compensation pattern**: Each step has a compensation function that rolls back on failure.

### 2. Order Splitting Workflow Pattern

When a cart contains products from multiple vendors:

```
┌──────────────────┐
│  Customer Cart   │──┐
│  (mixed vendors) │  │
└──────────────────┘  │
                      ▼
         ┌────────────────────────┐
         │   groupVendorItemsStep │
         │   (query product links)│
         └────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  completeCartWorkflow  │
         │  (creates parent order)│
         └────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │ createVendorOrdersStep │
         │  ┌──────────────────┐  │
         │  │ Single vendor?   │  │
         │  │ Link parent order│  │
         │  └──────────────────┘  │
         │  ┌──────────────────┐  │
         │  │ Multiple vendors?│  │
         │  │ Create child     │  │
         │  │ orders per vendor│  │
         │  └──────────────────┘  │
         └────────────────────────┘
```

**Key implementation details**:
- Uses `createOrderWorkflow` to create child orders
- Child orders preserve parent order reference in `metadata.parent_order_id`
- Links are created via `createRemoteLinkStep`

```typescript
// Order data preparation for child orders
function prepareOrderData(items, parentOrder) {
  return {
    items,
    metadata: { parent_order_id: parentOrder.id },
    region_id: parentOrder.region_id,
    customer_id: parentOrder.customer_id,
    sales_channel_id: parentOrder.sales_channel_id,
    // ... copy all parent order context
  }
}
```

### 3. Long-Running Workflow Pattern

For multi-step processes with human/external system interactions:

```typescript
export const handleDeliveryWorkflow = createWorkflow(
  {
    name: handleDeliveryWorkflowId,
    store: true,              // Persist execution state
    retentionTime: TWO_HOURS, // How long to keep execution data
  },
  function (input: WorkflowInput) {
    // Synchronous steps
    setTransactionIdStep(input.delivery_id)
    
    // Async steps (wait for external trigger)
    notifyRestaurantStep(input.delivery_id)      // Async
    awaitDriverClaimStep()                       // Async
    
    // More sync steps
    const { order, linkDef } = createOrderStep(input.delivery_id)
    createRemoteLinkStep(linkDef)
    
    // More async steps
    awaitStartPreparationStep()                  // Async
    awaitPreparationStep()                       // Async
    createFulfillmentStep(order)
    awaitPickUpStep()                            // Async
    awaitDeliveryStep()                          // Async
    
    return new WorkflowResponse("Delivery completed")
  }
)
```

**Advancing async steps**:
```typescript
// API route advances workflow by setting step success
await workflowEngine.setStepSuccess({
  idempotencyKey: {
    action: TransactionHandlerType.INVOKE,
    transactionId: delivery.transaction_id,
    stepId: notifyRestaurantStepId,
    workflowId: handleDeliveryWorkflowId,
  },
  stepResponse: new StepResponse(updatedDelivery, updatedDelivery.id),
})
```

### 4. Product Creation with Linking Pattern

```
┌──────────────────────────┐
│ Retrieve default sales   │
│ channel via useQuery     │
└──────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│ createProductsWorkflow   │
│ (creates product in      │
│  Product Module)         │
└──────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│ Retrieve admin's vendor  │
│ via useQueryGraphStep    │
└──────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│ createRemoteLinkStep     │
│ (links vendor to product)│
└──────────────────────────┘
```

---

## Query Patterns for Multi-tenant Data

### 1. Retrieve Tenant-Scoped Resources

```typescript
// Get all products for the authenticated admin's vendor
const { data: [vendorAdmin] } = await query.graph({
  entity: "vendor_admin",
  fields: ["vendor.products.*"],  // Traverse link to get products
  filters: {
    id: [req.auth_context.actor_id],
  },
})

return vendorAdmin.vendor.products
```

### 2. Retrieve Tenant-Scoped Orders

```typescript
// 1. Get order IDs linked to vendor
const { data: [vendorAdmin] } = await query.graph({
  entity: "vendor_admin",
  fields: ["vendor.orders.*"],
  filters: { id: [req.auth_context.actor_id] },
})

// 2. Fetch full order details via workflow
const { result: orders } = await getOrdersListWorkflow(req.scope)
  .run({
    input: {
      fields: ["metadata", "total", "items.*", "shipping_methods"],
      variables: {
        filters: {
          id: vendorAdmin.vendor.orders?.map((o) => o?.id),
        },
      },
    },
  })
```

### 3. Cross-Module Query with Links

```typescript
// Get product with its vendor (traversing the link)
const { data: [product] } = await query.graph({
  entity: "product",
  fields: ["vendor.*"],  // vendor is a linked field
  filters: { id: item.product_id },
})

const vendorId = product.vendor?.id
```

---

## Links to Relevant Code

### Marketplace Example Repository
- **Full Code**: https://github.com/medusajs/examples/tree/main/marketplace
- **OpenAPI Specs**: https://res.cloudinary.com/dza7lstvk/raw/upload/v1720603521/OpenApi/Marketplace_OpenApi_n458oh.yml

### Restaurant-Delivery Marketplace (Advanced Example)
- **Full Code**: https://github.com/medusajs/examples/tree/main/restaurant-marketplace
- **OpenAPI Specs**: https://res.cloudinary.com/dza7lstvk/raw/upload/v1724757329/OpenApi/Restaurant-Delivery-Marketplace_vxao2l.yml
- **Medusa Eats** (reference implementation): https://github.com/medusajs/medusa-eats

### Key Medusa Documentation
- [Module Links](https://docs.medusajs.com/docs/learn/fundamentals/module-links/index.html.md)
- [Query](https://docs.medusajs.com/docs/learn/fundamentals/module-links/query/index.html.md)
- [Custom Actor Types](https://docs.medusajs.com/Users/shahednasser/medusa/www/apps/resources/app/commerce-modules/auth/create-actor-type/index.html.md)
- [Long-Running Workflows](https://docs.medusajs.com/docs/learn/fundamentals/workflows/long-running-workflow/index.html.md)

---

## Pattern Summary for TheRxSpot

| Pattern | TheRxSpot Application |
|---------|----------------------|
| **Vendor** → **Business** | Healthcare providers (pharmacies, clinics) |
| **VendorAdmin** → **Clinician** | Licensed providers managing their practice |
| **Driver** → **Patient** | Could be adapted for patient access patterns |
| **Product** → **Service/Offering** | Consultations, prescriptions, health services |
| **Order Splitting** | Split by provider for multi-provider consultations |
| **Long-Running Workflow** | Consultation lifecycle, prescription approval flows |

### Recommended Module Structure

```
src/modules/
├── business/              # Tenant entity (pharmacies, clinics)
│   ├── models/
│   │   ├── business.ts    # Vendor equivalent
│   │   ├── location.ts    # Practice locations
│   │   └── domain.ts      # Custom domains
│   ├── service.ts
│   └── index.ts
├── consultation/          # Clinical workflows
│   ├── models/
│   │   ├── clinician.ts   # VendorAdmin equivalent
│   │   └── patient.ts
│   └── ...
├── financials/            # Earnings, payouts
├── compliance/            # Audit logs, documents
```

---

*Extracted from Medusa V2 Marketplace Recipe - For internal architectural reference only*
