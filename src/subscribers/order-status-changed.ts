import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../modules/business"

/**
 * Handler for order status change events
 * - Creates OrderStatusEvent records
 * - Triggers notifications when appropriate
 */
export default async function orderStatusChangedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const { id: orderId } = event.data

  const orderService = container.resolve(Modules.ORDER)
  const businessService = container.resolve(BUSINESS_MODULE)

  try {
    // Fetch order
    const order = await orderService.retrieveOrder(orderId)

    if (!order) {
      console.error(`[order-status-changed] Order not found: ${orderId}`)
      return
    }

    const customStatus = order.metadata?.custom_status as string | undefined
    const previousStatus = order.metadata?.previous_status as string | undefined

    // If no custom status change, skip
    if (!customStatus || customStatus === previousStatus) {
      return
    }

    // Create status event record if not already created by workflow
    const recentEvents = await businessService.listOrderStatusEvents(
      {
        order_id: orderId,
        to_status: customStatus,
      },
      { take: 1, order: { created_at: "DESC" } }
    )

    // If no recent event exists for this transition, create one
    if (recentEvents.length === 0) {
      const businessId = String(order.metadata?.business_id ?? "")
      if (!businessId) {
        console.error(
          `[order-status-changed] Missing order.metadata.business_id for order ${orderId}; skipping OrderStatusEvent creation`
        )
        return
      }

      await businessService.createOrderStatusEvents({
        order_id: orderId,
        business_id: businessId,
        from_status: previousStatus || "unknown",
        to_status: customStatus,
        triggered_by: "system",
        reason: "Status change detected",
        metadata: {
          medusa_status: order.status,
          payment_status: (order as any).payment_status,
          fulfillment_status: (order as any).fulfillment_status,
        },
      })
    }

    // Trigger notifications based on status
    await triggerNotifications(container, orderId, customStatus, order)

    // Update previous_status in metadata
    const nextMetadata = {
      ...(order.metadata ?? {}),
      previous_status: customStatus,
    }

    await orderService.updateOrders({ id: orderId, metadata: nextMetadata } as any)

    console.log(
      `[order-status-changed] Order ${orderId} status: ${previousStatus} -> ${customStatus}`
    )
  } catch (error) {
    console.error(
      `[order-status-changed] Error processing order ${orderId}:`,
      error instanceof Error ? error.message : error
    )
  }
}

/**
 * Trigger appropriate notifications based on order status
 */
async function triggerNotifications(
  container: any,
  orderId: string,
  status: string,
  order: any
): Promise<void> {
  // Note: In a real implementation, you would integrate with
  // a notification service (email, SMS, push)

  switch (status) {
    case "consult_pending":
      // Notify patient that consultation is pending
      console.log(`[notification] Order ${orderId}: Consultation pending`)
      break

    case "consult_complete":
      // Notify patient that consultation approved, order processing
      console.log(`[notification] Order ${orderId}: Consultation approved`)
      break

    case "consult_rejected":
      // Notify patient that consultation rejected, order cancelled
      console.log(`[notification] Order ${orderId}: Consultation rejected`)
      break

    case "processing":
      // Notify patient that order is being prepared
      console.log(`[notification] Order ${orderId}: Being processed`)
      break

    case "fulfilled":
      // Notify patient that order has shipped/ready for pickup
      console.log(`[notification] Order ${orderId}: Fulfilled`)
      break

    case "delivered":
      // Notify patient of delivery, request confirmation
      console.log(`[notification] Order ${orderId}: Delivered`)
      break

    case "cancelled":
      // Notify patient of cancellation
      console.log(`[notification] Order ${orderId}: Cancelled`)
      break

    case "refunded":
      // Notify patient of refund
      console.log(`[notification] Order ${orderId}: Refunded`)
      break

    default:
      break
  }
}

export const config: SubscriberConfig = {
  event: "order.updated",
}
