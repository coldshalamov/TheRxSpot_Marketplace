# Core Workflows Reference

> Built-in Medusa workflows from `@medusajs/medusa/core-flows`
> Use these as steps in custom workflows or run independently

---

## Cart & Checkout

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `addToCartWorkflow` | Add items to cart | `{ cart_id, items }` | Updated cart |
| `createCartWorkflow` | Create new cart | `{ region_id, items?, ... }` | New cart |
| `completeCartWorkflow` | Complete checkout | `{ cart_id }` | Order |
| `deleteLineItemsWorkflow` | Remove line items | `{ cart_id, ids }` | Updated cart |
| `updateCartWorkflow` | Update cart data | `{ id, ...updates }` | Updated cart |
| `refreshCartWorkflow` | Recalculate cart | `{ cart_id }` | Refreshed cart |
| `updateLineItemWorkflow` | Update line item | `{ cart_id, item_id, ... }` | Updated item |

### Usage Example
```typescript
import { addToCartWorkflow, completeCartWorkflow } from "@medusajs/medusa/core-flows"

// As workflow step
const cart = addToCartWorkflow.runAsStep({
  input: {
    cart_id: "cart_123",
    items: [{ variant_id: "var_123", quantity: 2 }]
  }
})

// Complete checkout
const order = completeCartWorkflow.runAsStep({
  input: { cart_id: cart.id }
})
```

---

## Order Management

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `createOrderWorkflow` | Create order (draft or from cart) | `{ items, region_id, ... }` | Order |
| `cancelOrderWorkflow` | Cancel order | `{ order_id }` | Canceled order |
| `updateOrderWorkflow` | Update order | `{ id, ...updates }` | Updated order |
| `createOrderFulfillmentWorkflow` | Create fulfillment | `{ order_id, items, ... }` | Fulfillment |
| `cancelOrderFulfillmentWorkflow` | Cancel fulfillment | `{ order_id, fulfillment_id }` | Canceled fulfillment |
| `createOrderShipmentWorkflow` | Mark as shipped | `{ order_id, fulfillment_id, ... }` | Shipment |
| `archiveOrderWorkflow` | Archive order | `{ order_id }` | Archived order |
| `completeOrderWorkflow` | Mark as completed | `{ order_id }` | Completed order |

### Usage Example
```typescript
import { createOrderWorkflow, cancelOrderWorkflow } from "@medusajs/medusa/core-flows"

// Create draft order
const draftOrder = createOrderWorkflow.runAsStep({
  input: {
    is_draft_order: true,
    email: "customer@example.com",
    items: [...],
    currency_code: "usd"
  }
})
```

---

## Product Management

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `batchProductsWorkflow` | Batch product operations | `{ create?, update?, delete? }` | Results |
| `createProductsWorkflow` | Create products | `{ products: [...] }` | Created products |
| `updateProductsWorkflow` | Update products | `{ products: [...] }` | Updated products |
| `deleteProductsWorkflow` | Delete products | `{ ids: [...] }` | Deleted count |
| `createProductVariantsWorkflow` | Create variants | `{ product_id, variants: [...] }` | Created variants |
| `updateProductVariantsWorkflow` | Update variants | `{ variants: [...] }` | Updated variants |
| `deleteProductVariantsWorkflow` | Delete variants | `{ ids: [...] }` | Deleted count |
| `createCollectionsWorkflow` | Create collections | `{ collections: [...] }` | Created collections |
| `updateCollectionsWorkflow` | Update collections | `{ collections: [...] }` | Updated collections |
| `deleteCollectionsWorkflow` | Delete collections | `{ ids: [...] }` | Deleted count |

### Usage Example
```typescript
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

// With hooks
const products = createProductsWorkflow.runAsStep({
  input: {
    products: [{
      title: "New Product",
      variants: [...]
    }]
  }
})

// Consume hook
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

createProductsWorkflow.hooks.productsCreated(
  async ({ products, additional_data }, { container }) => {
    // Custom logic after products created
    return new StepResponse(result, compensationData)
  },
  async (compensationData, { container }) => {
    // Compensation
  }
)
```

---

## Customer Management

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `createCustomersWorkflow` | Create customers | `{ customers: [...] }` | Created customers |
| `updateCustomersWorkflow` | Update customers | `{ customers: [...] }` | Updated customers |
| `deleteCustomersWorkflow` | Delete customers | `{ ids: [...] }` | Deleted count |
| `createCustomerGroupsWorkflow` | Create groups | `{ groups: [...] }` | Created groups |
| `updateCustomerGroupsWorkflow` | Update groups | `{ groups: [...] }` | Updated groups |
| `deleteCustomerGroupsWorkflow` | Delete groups | `{ ids: [...] }` | Deleted count |
| `addCustomerToGroupWorkflow` | Add to group | `{ customer_id, group_id }` | Membership |
| `removeCustomerFromGroupWorkflow` | Remove from group | `{ customer_id, group_id }` | Removed |

### Usage Example
```typescript
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"

const customers = createCustomersWorkflow.runAsStep({
  input: {
    customers: [{
      email: "new@example.com",
      first_name: "John"
    }]
  }
})
```

---

## Inventory Management

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `adjustInventoryLevelsStep` | Adjust stock level | `{ inventory_item_id, location_id, adjustment }` | Updated level |
| `createInventoryItemsWorkflow` | Create items | `{ items: [...] }` | Created items |
| `updateInventoryItemsWorkflow` | Update items | `{ items: [...] }` | Updated items |
| `deleteInventoryItemsWorkflow` | Delete items | `{ ids: [...] }` | Deleted count |
| `attachInventoryItemsWorkflow` | Link to variant | `{ inventory_item_id, variant_id }` | Link created |
| `reserveInventoryWorkflow` | Reserve stock | `{ items: [...], location_id }` | Reservations |

### Usage Example
```typescript
import { adjustInventoryLevelsStep } from "@medusajs/medusa/core-flows"

adjustInventoryLevelsStep({
  inventory_item_id: "inv_123",
  location_id: "loc_123",
  adjustment: -5 // Decrease by 5
})
```

---

## User & Auth Management

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `createUsersWorkflow` | Create users | `{ users: [...] }` | Created users |
| `updateUsersWorkflow` | Update users | `{ users: [...] }` | Updated users |
| `deleteUsersWorkflow` | Delete users | `{ ids: [...] }` | Deleted count |
| `setAuthAppMetadataStep` | Link auth to user | `{ authIdentityId, actorType, value }` | Updated |
| `createInviteWorkflow` | Create invite | `{ email, metadata? }` | Invite |
| `acceptInviteWorkflow` | Accept invite | `{ invite_token, user }` | User |

### Usage Example
```typescript
import { createUsersWorkflow, setAuthAppMetadataStep } from "@medusajs/medusa/core-flows"
import { transform } from "@medusajs/framework/workflows-sdk"

const users = createUsersWorkflow.runAsStep({
  input: {
    users: [{
      email: "admin@example.com",
      first_name: "Admin"
    }]
  }
})

// Transform for next step
const authInput = transform({ input, users }, ({ input, users }) => ({
  authIdentityId: input.auth_identity_id,
  actorType: "user",
  value: users[0].id
}))

setAuthAppMetadataStep(authInput)
```

---

## Promotion & Pricing

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `createPromotionsWorkflow` | Create promotions | `{ promotions: [...] }` | Created promotions |
| `updatePromotionsWorkflow` | Update promotions | `{ promotions: [...] }` | Updated promotions |
| `deletePromotionsWorkflow` | Delete promotions | `{ ids: [...] }` | Deleted count |
| `createCampaignsWorkflow` | Create campaigns | `{ campaigns: [...] }` | Created campaigns |
| `createPriceListsWorkflow` | Create price lists | `{ price_lists: [...] }` | Created price lists |
| `updatePriceListsWorkflow` | Update price lists | `{ price_lists: [...] }` | Updated price lists |
| `deletePriceListsWorkflow` | Delete price lists | `{ ids: [...] }` | Deleted count |
| `createPricePreferencesWorkflow` | Create preferences | `{ price_preferences: [...] }` | Created |
| `updatePricePreferencesWorkflow` | Update preferences | `{ price_preferences: [...] }` | Updated |

---

## Region & Store

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `createRegionsWorkflow` | Create regions | `{ regions: [...] }` | Created regions |
| `updateRegionsWorkflow` | Update regions | `{ regions: [...] }` | Updated regions |
| `deleteRegionsWorkflow` | Delete regions | `{ ids: [...] }` | Deleted count |
| `createStoresWorkflow` | Create stores | `{ stores: [...] }` | Created stores |
| `updateStoresWorkflow` | Update stores | `{ stores: [...] }` | Updated stores |

---

## Sales Channel

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `createSalesChannelsWorkflow` | Create channels | `{ sales_channels: [...] }` | Created channels |
| `updateSalesChannelsWorkflow` | Update channels | `{ sales_channels: [...] }` | Updated channels |
| `deleteSalesChannelsWorkflow` | Delete channels | `{ ids: [...] }` | Deleted count |
| `associateProductsWithSalesChannelWorkflow` | Link products | `{ sales_channel_id, product_ids }` | Associated |
| `removeProductsFromSalesChannelWorkflow` | Unlink products | `{ sales_channel_id, product_ids }` | Removed |

---

## Payment

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `createPaymentSessionsWorkflow` | Create sessions | `{ cart_id, provider_id }` | Sessions |
| `completePaymentCollectionWorkflow` | Complete payment | `{ payment_collection_id }` | Completed |
| `refundPaymentWorkflow` | Process refund | `{ payment_id, amount }` | Refund |
| `capturePaymentWorkflow` | Capture payment | `{ payment_id, amount }` | Capture |

---

## Shipping & Fulfillment

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `createShippingOptionsWorkflow` | Create options | `{ shipping_options: [...] }` | Created options |
| `updateShippingOptionsWorkflow` | Update options | `{ shipping_options: [...] }` | Updated options |
| `deleteShippingOptionsWorkflow` | Delete options | `{ ids: [...] }` | Deleted count |
| `createShippingProfilesWorkflow` | Create profiles | `{ shipping_profiles: [...] }` | Created profiles |
| `createFulfillmentWorkflow` | Create fulfillment | `{ order_id, items, ... }` | Fulfillment |
| `cancelFulfillmentWorkflow` | Cancel fulfillment | `{ id }` | Canceled |

---

## Tax

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `createTaxRegionsWorkflow` | Create tax regions | `{ tax_regions: [...] }` | Created regions |
| `updateTaxRegionsWorkflow` | Update tax regions | `{ tax_regions: [...] }` | Updated regions |
| `deleteTaxRegionsWorkflow` | Delete tax regions | `{ ids: [...] }` | Deleted count |
| `createTaxRatesWorkflow` | Create tax rates | `{ tax_rates: [...] }` | Created rates |
| `updateTaxRatesWorkflow` | Update tax rates | `{ tax_rates: [...] }` | Updated rates |

---

## Notification

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `sendNotificationsStep` | Send notifications | `{ to, channel, template, data }` | Sent |

### Usage Example
```typescript
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"

sendNotificationsStep({
  to: "customer@example.com",
  channel: "email",
  template: "order-confirmation",
  data: {
    order_id: "order_123",
    total: 100.00
  }
})
```

---

## File Upload

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| `uploadFilesWorkflow` | Upload files | `{ files: [...] }` | Uploaded files |
| `deleteFilesWorkflow` | Delete files | `{ ids: [...] }` | Deleted count |

### Usage Example
```typescript
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"

const { result } = await uploadFilesWorkflow(req.scope).run({
  input: {
    files: files.map(f => ({
      filename: f.originalname,
      mimeType: f.mimetype,
      content: f.buffer.toString("binary"),
      access: "public"
    }))
  }
})
```

---

## Locking (Concurrency Control)

| Step | Purpose | Input | Output |
|------|---------|-------|--------|
| `acquireLockStep` | Acquire distributed lock | `{ key, timeout?, ttl? }` | Lock |
| `releaseLockStep` | Release lock | `{ key }` | Released |

### Usage Example
```typescript
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"

// Prevent concurrent modifications
acquireLockStep({
  key: input.cart_id,
  timeout: 2,  // Wait up to 2 seconds
  ttl: 10      // Lock expires after 10 seconds
})

// ... workflow steps ...

releaseLockStep({ key: input.cart_id })
```

---

## Query Steps

| Step | Purpose | Input | Output |
|------|---------|-------|--------|
| `useQueryGraphStep` | Query entities | `{ entity, fields, filters?, ... }` | `{ data, metadata }` |
| `useRemoteQueryStep` | Remote query | `{ entry_point, fields, ... }` | Query result |

### Usage Example
```typescript
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"

const { data: carts } = useQueryGraphStep({
  entity: "cart",
  fields: [
    "id",
    "items.*",
    "customer.id",
    "customer.email"
  ],
  filters: { id: input.cart_id },
  options: { throwIfKeyNotFound: true }
}).config({ name: "retrieve-cart" })
```

---

## Link Steps

| Step | Purpose | Input | Output |
|------|---------|-------|--------|
| `createRemoteLinkStep` | Create module link | `{ [MODULE]: { id }, ... }` | Created link |
| `dismissRemoteLinkStep` | Dismiss link | `{ [MODULE]: { id }, ... }` | Dismissed |
| `removeRemoteLinkStep` | Remove by query | `{ [MODULE]: { id }, ... }` | Removed |
| `updateRemoteLinksStep` | Update links | `{ [MODULE]: { id }, ... }` | Updated |

### Usage Example
```typescript
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"

createRemoteLinkStep({
  [Modules.CUSTOMER]: { customer_id: "cus_123" },
  [Modules.ORDER]: { order_id: "ord_123" }
})
```

---

## Event Steps

| Step | Purpose | Input | Output |
|------|---------|-------|--------|
| `emitEventStep` | Emit custom event | `{ eventName, data }` | Emitted |

### Usage Example
```typescript
import { emitEventStep } from "@medusajs/medusa/core-flows"

emitEventStep({
  eventName: "business.activated",
  data: { id: business.id, activated_at: new Date() }
})
```

---

## Workflow Hooks

Consume hooks from core workflows to inject custom logic:

| Workflow | Hook | When Triggered |
|----------|------|----------------|
| `createProductsWorkflow` | `productsCreated` | After products created |
| `updateProductsWorkflow` | `productsUpdated` | After products updated |
| `deleteProductsWorkflow` | `productsDeleted` | After products deleted |
| `createCustomersWorkflow` | `customersCreated` | After customers created |
| `completeCartWorkflow` | `validate` | Before cart completion |
| `completeCartWorkflow` | `onPaymentProcessed` | After payment |
| `createOrderWorkflow` | `orderCreated` | After order created |

### Usage Example
```typescript
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaError } from "@medusajs/framework/utils"

completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const businessService = container.resolve(BUSINESS_MODULE)
  
  // Multi-tenant validation
  if (cart.metadata?.business_id) {
    const business = await businessService.retrieveBusiness(
      cart.metadata.business_id
    )
    
    if (business.status !== "active") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Business is not active"
      )
    }
  }
})
```

---

## Complete Custom Workflow Example

```typescript
// src/workflows/create-business-order.ts
import {
  createWorkflow,
  WorkflowResponse,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  createOrderWorkflow,
  useQueryGraphStep,
  emitEventStep,
  acquireLockStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { createBusinessOrderStep } from "./steps/create-business-order-step"

export type CreateBusinessOrderInput = {
  cart_id: string
  customer_id: string
  business_id: string
}

export const createBusinessOrderWorkflow = createWorkflow(
  "create-business-order",
  (input: CreateBusinessOrderInput) => {
    // Prevent concurrent modifications
    acquireLockStep({
      key: input.cart_id,
      timeout: 5,
      ttl: 30,
    })

    // Retrieve cart data
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: [
        "id",
        "items.*",
        "customer.*",
        "currency_code",
        "region_id",
      ],
      filters: { id: input.cart_id },
      options: { throwIfKeyNotFound: true },
    })

    // Transform for order creation
    const orderInput = transform({ carts, input }, ({ carts, input }) => ({
      items: carts[0].items,
      currency_code: carts[0].currency_code,
      region_id: carts[0].region_id,
      customer_id: input.customer_id,
      metadata: { business_id: input.business_id },
    }))

    // Create order using core workflow
    const order = createOrderWorkflow.runAsStep({
      input: orderInput,
    })

    // Conditional: Emit event if business order
    when({ input }, (data) => !!data.input.business_id)
      .then(() => {
        emitEventStep({
          eventName: "business.order_created",
          data: {
            order_id: order.id,
            business_id: input.business_id,
          },
        })
      })

    // Release lock
    releaseLockStep({ key: input.cart_id })

    return new WorkflowResponse({ order })
  }
)
```
