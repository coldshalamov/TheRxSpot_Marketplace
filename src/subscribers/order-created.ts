import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { FINANCIALS_MODULE } from "../modules/financials"
import { BUSINESS_MODULE } from "../modules/business"

/**
 * Handler for order.created event
 * - Initializes custom order status (consult_pending for consult-required items)
 * - Creates OrderStatusEvent record
 * Note: Earnings are created by the order.placed subscriber in order-placed.ts
 * This subscriber focuses on setting up the order workflow state
 */
export default async function orderCreatedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const { id: orderId } = event.data

  const orderService = container.resolve(Modules.ORDER)
  const businessService = container.resolve(BUSINESS_MODULE)

  try {
    // Fetch order with items
    const order = await orderService.retrieveOrder(orderId, {
      relations: ["items", "items.variant", "items.variant.product"],
    })

    if (!order) {
      console.error(`[order-created] Order not found: ${orderId}`)
      return
    }

    // Check if order requires consultation
    // This can be determined by product metadata or category
    let requiresConsultation = false

    for (const item of order.items || []) {
      const product = item.variant?.product
      if (product?.metadata?.requires_consultation) {
        requiresConsultation = true
        break
      }
    }

    // Determine initial status
    const initialStatus = requiresConsultation ? "consult_pending" : "pending"

    // Set custom status in order metadata
    await orderService.updateOrders(orderId, {
      metadata: {
        ...order.metadata,
        custom_status: initialStatus,
        requires_consultation: requiresConsultation,
        status_updated_at: new Date().toISOString(),
      },
    })

    // Create OrderStatusEvent record
    await businessService.createOrderStatusEvents({
      order_id: orderId,
      from_status: "pending",
      to_status: initialStatus,
      changed_by: "system",
      reason: requiresConsultation
        ? "Order contains items requiring consultation"
        : "Standard order created",
      metadata: {
        requires_consultation: requiresConsultation,
      },
    })

    console.log(
      `[order-created] Order ${orderId} initialized with status: ${initialStatus}`
    )
  } catch (error) {
    console.error(
      `[order-created] Error processing order ${orderId}:`,
      error instanceof Error ? error.message : error
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.created",
}
