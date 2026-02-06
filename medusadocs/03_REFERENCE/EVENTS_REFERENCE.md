# Events Reference

> Complete list of events that can be subscribed to in Medusa V2
> Subscribe in `src/subscribers/*.ts` files

---

## Event Naming Convention

Events follow the pattern: `{entity}.{action}`

- `entity` - The entity being acted upon (snake_case)
- `action` - The action performed

Common actions: `created`, `updated`, `deleted`, `placed`, `canceled`, `completed`

---

## Cart Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `cart.created` | Cart is created | `{ id: string }` |
| `cart.updated` | Cart is updated | `{ id: string }` |
| `cart.deleted` | Cart is deleted | `{ id: string }` |

---

## Order Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `order.placed` | Order is placed (completed) | `{ id: string }` |
| `order.created` | Order is created (draft) | `{ id: string }` |
| `order.updated` | Order is updated | `{ id: string }` |
| `order.canceled` | Order is canceled | `{ id: string }` |
| `order.completed` | Order is marked complete | `{ id: string }` |
| `order.archived` | Order is archived | `{ id: string }` |

### Fulfillment Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `order.fulfillment_created` | Fulfillment created | `{ id: string, order_id: string }` |
| `order.fulfillment_canceled` | Fulfillment canceled | `{ id: string, order_id: string }` |
| `order.shipment_created` | Shipment created | `{ id: string, order_id: string }` |

### Payment Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `order.payment_captured` | Payment captured | `{ id: string, amount: number }` |
| `order.refund_created` | Refund processed | `{ id: string, amount: number }` |

---

## Product Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `product.created` | Product is created | `{ id: string }` |
| `product.updated` | Product is updated | `{ id: string }` |
| `product.deleted` | Product is deleted | `{ id: string }` |

### Variant Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `product-variant.created` | Variant is created | `{ id: string }` |
| `product-variant.updated` | Variant is updated | `{ id: string }` |
| `product-variant.deleted` | Variant is deleted | `{ id: string }` |

### Category Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `product-category.created` | Category created | `{ id: string }` |
| `product-category.updated` | Category updated | `{ id: string }` |
| `product-category.deleted` | Category deleted | `{ id: string }` |

### Collection Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `product-collection.created` | Collection created | `{ id: string }` |
| `product-collection.updated` | Collection updated | `{ id: string }` |
| `product-collection.deleted` | Collection deleted | `{ id: string }` |

### Tag Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `product-tag.created` | Tag created | `{ id: string }` |
| `product-tag.updated` | Tag updated | `{ id: string }` |
| `product-tag.deleted` | Tag deleted | `{ id: string }` |

### Type Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `product-type.created` | Type created | `{ id: string }` |
| `product-type.updated` | Type updated | `{ id: string }` |
| `product-type.deleted` | Type deleted | `{ id: string }` |

---

## Customer Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `customer.created` | Customer is created | `{ id: string }` |
| `customer.updated` | Customer is updated | `{ id: string }` |
| `customer.deleted` | Customer is deleted | `{ id: string }` |

### Customer Group Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `customer-group.created` | Group created | `{ id: string }` |
| `customer-group.updated` | Group updated | `{ id: string }` |
| `customer-group.deleted` | Group deleted | `{ id: string }` |

---

## User Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `user.created` | User is created | `{ id: string }` |
| `user.updated` | User is updated | `{ id: string }` |
| `user.deleted` | User is deleted | `{ id: string }` |

### Invite Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `invite.created` | Invite is sent | `{ id: string, email: string }` |
| `invite.accepted` | Invite is accepted | `{ id: string, user_id: string }` |
| `invite.deleted` | Invite is deleted | `{ id: string }` |

---

## Auth Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `auth.password_reset` | Password reset requested | `{ entity_id: string, token: string }` |

---

## Region Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `region.created` | Region is created | `{ id: string }` |
| `region.updated` | Region is updated | `{ id: string }` |
| `region.deleted` | Region is deleted | `{ id: string }` |

---

## Sales Channel Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `sales-channel.created` | Channel created | `{ id: string }` |
| `sales-channel.updated` | Channel updated | `{ id: string }` |
| `sales-channel.deleted` | Channel deleted | `{ id: string }` |

---

## Inventory Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `inventory-item.created` | Item created | `{ id: string }` |
| `inventory-item.updated` | Item updated | `{ id: string }` |
| `inventory-item.deleted` | Item deleted | `{ id: string }` |
| `inventory-level.updated` | Level adjusted | `{ id: string, inventory_item_id: string }` |
| `reservation-item.created` | Reservation created | `{ id: string }` |
| `reservation-item.deleted` | Reservation removed | `{ id: string }` |

---

## Shipping Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `shipping-option.created` | Option created | `{ id: string }` |
| `shipping-option.updated` | Option updated | `{ id: string }` |
| `shipping-option.deleted` | Option deleted | `{ id: string }` |
| `shipping-method.created` | Method created | `{ id: string }` |
| `shipping-profile.created` | Profile created | `{ id: string }` |
| `shipping-profile.updated` | Profile updated | `{ id: string }` |
| `shipping-profile.deleted` | Profile deleted | `{ id: string }` |

---

## Fulfillment Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `fulfillment.created` | Fulfillment created | `{ id: string }` |
| `fulfillment.canceled` | Fulfillment canceled | `{ id: string }` |
| `fulfillment.shipment_created` | Shipment created | `{ id: string }` |
| `fulfillment.delivered` | Fulfillment delivered | `{ id: string }` |

---

## Payment Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `payment.created` | Payment created | `{ id: string }` |
| `payment.captured` | Payment captured | `{ id: string, amount: number }` |
| `payment.refunded` | Payment refunded | `{ id: string, amount: number }` |
| `payment-session.created` | Session created | `{ id: string }` |
| `payment-collection.created` | Collection created | `{ id: string }` |
| `payment-collection.completed` | Collection completed | `{ id: string }` |

---

## Promotion Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `promotion.created` | Promotion created | `{ id: string }` |
| `promotion.updated` | Promotion updated | `{ id: string }` |
| `promotion.deleted` | Promotion deleted | `{ id: string }` |
| `campaign.created` | Campaign created | `{ id: string }` |
| `campaign.updated` | Campaign updated | `{ id: string }` |
| `campaign.deleted` | Campaign deleted | `{ id: string }` |

---

## Price List Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `price-list.created` | Price list created | `{ id: string }` |
| `price-list.updated` | Price list updated | `{ id: string }` |
| `price-list.deleted` | Price list deleted | `{ id: string }` |
| `price-list.published` | Price list published | `{ id: string }` |

---

## Tax Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `tax-region.created` | Tax region created | `{ id: string }` |
| `tax-region.updated` | Tax region updated | `{ id: string }` |
| `tax-region.deleted` | Tax region deleted | `{ id: string }` |
| `tax-rate.created` | Tax rate created | `{ id: string }` |
| `tax-rate.updated` | Tax rate updated | `{ id: string }` |
| `tax-rate.deleted` | Tax rate deleted | `{ id: string }` |

---

## Store Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `store.created` | Store created | `{ id: string }` |
| `store.updated` | Store updated | `{ id: string }` |

---

## Notification Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `notification.created` | Notification sent | `{ id: string, to: string, template: string }` |
| `notification.failed` | Notification failed | `{ id: string, error: string }` |

---

## File Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `file.uploaded` | File uploaded | `{ id: string, filename: string }` |
| `file.deleted` | File deleted | `{ id: string }` |

---

## Custom Events (TheRxSpot Marketplace)

These events are specific to this codebase:

### Business Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `business.created` | Business created | `{ id: string }` |
| `business.updated` | Business updated | `{ id: string }` |
| `business.deleted` | Business deleted | `{ id: string }` |
| `business.activated` | Business activated | `{ id: string }` |
| `business.deactivated` | Business deactivated | `{ id: string }` |
| `business.status_changed` | Status changed | `{ id: string, from: string, to: string }` |

### Consultation Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `consultation.created` | Consultation created | `{ id: string }` |
| `consultation.updated` | Consultation updated | `{ id: string }` |
| `consultation.completed` | Consultation completed | `{ id: string }` |
| `consultation.canceled` | Consultation canceled | `{ id: string }` |
| `consultation.assigned` | Clinician assigned | `{ id: string, clinician_id: string }` |
| `consultation.status_changed` | Status changed | `{ id: string, from: string, to: string }` |
| `consultation.notes_update` | Notes updated | `{ id: string }` |
| `consultation.export` | Data exported | `{ id: string }` |

### Consult Submission Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `consult_submission.created` | Submission created | `{ id: string, consultation_id: string }` |
| `consult_submission.approved` | Submission approved | `{ id: string }` |
| `consult_submission.rejected` | Submission rejected | `{ id: string }` |

### Clinician Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `clinician.created` | Clinician created | `{ id: string }` |
| `clinician.updated` | Clinician updated | `{ id: string }` |
| `clinician.verified` | Clinician verified | `{ id: string }` |

### Patient Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `patient.created` | Patient created | `{ id: string }` |
| `patient.updated` | Patient updated | `{ id: string }` |

### Financial Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `earning.created` | Earning recorded | `{ id: string }` |
| `payout.processed` | Payout processed | `{ id: string, amount: number }` |
| `payout.failed` | Payout failed | `{ id: string, reason: string }` |

### Audit Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `audit.log_created` | Audit log entry | `{ id: string, entity: string, action: string }` |

### Custom Order Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `order_refund_requested_stub` | Refund stub logged | `{ id: string }` |
| `order_fulfillment_status_update` | Fulfillment status changed | `{ id: string, from: string, to: string }` |
| `order_bulk_fulfillment_update` | Bulk fulfillment updated | `{ ids: string[] }` |

---

## Subscriber Example

### Basic Subscriber
```typescript
// src/subscribers/order-placed.ts
import {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { sendOrderConfirmationWorkflow } from "../workflows/send-order-confirmation"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const { result } = await sendOrderConfirmationWorkflow(container).run({
    input: { orderId: data.id }
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
```

### Multiple Events
```typescript
// src/subscribers/product-events.ts
import { SubscriberConfig } from "@medusajs/framework"

export default async function productEventHandler({
  event: { data, name },
  container,
}) {
  const logger = container.resolve("logger")
  logger.info(`Product ${name} for ${data.id}`)
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated", "product.deleted"],
}
```

### Subscriber with Query
```typescript
// src/subscribers/consultation-completed.ts
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function consultationCompletedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  
  const { data: consultations } = await query.graph({
    entity: "consultation",
    fields: ["*", "patient.*", "clinician.*", "business.*"],
    filters: { id: data.id },
  })
  
  if (!consultations.length) return
  
  const consultation = consultations[0]
  // Process completed consultation...
}

export const config: SubscriberConfig = {
  event: "consultation.completed",
}
```

---

## Emitting Custom Events

### From Workflows
```typescript
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { myStep } from "./steps/my-step"

export const myWorkflow = createWorkflow(
  "my-workflow",
  (input) => {
    const result = myStep(input)
    
    emitEventStep({
      eventName: "business.activated",
      data: { id: result.id, activated_at: new Date() },
    })
    
    return new WorkflowResponse(result)
  }
)
```

### From Services
```typescript
// In custom service method
async activateBusiness(id: string) {
  const business = await this.updateBusinesses({
    id,
    status: "active",
  })
  
  await this.eventBus.emit("business.activated", {
    id: business.id,
  })
  
  return business
}
```

---

## Event Payload Types

Standard payload structure:

```typescript
// Single entity events
{ id: string }

// With additional metadata
{ 
  id: string,
  metadata?: Record<string, any>
}

// Status change events
{
  id: string,
  from: string,
  to: string
}

// Batch events
{
  ids: string[]
}
```

---

## Event Bus Container Key

```typescript
// Resolve event bus
const eventBus = container.resolve("event_bus")
// or
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
const eventBus = container.resolve(ContainerRegistrationKeys.EVENT_BUS)

// Emit event
await eventBus.emit("custom.event", {
  id: "entity_id",
  data: { ... }
})
```
