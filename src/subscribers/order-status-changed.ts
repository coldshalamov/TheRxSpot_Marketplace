import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../modules/business"
import { getLogger } from "../utils/logger"

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
  const logger = getLogger()

  try {
    // Fetch order
    const order = await orderService.retrieveOrder(orderId)

    if (!order) {
      logger.error({ order_id: orderId }, "order-status-changed: order not found")
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
        logger.error(
          { order_id: orderId },
          "order-status-changed: missing metadata.business_id; skipping OrderStatusEvent creation"
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
    await triggerNotifications(logger, orderId, customStatus, order)

    // Update previous_status in metadata
    const nextMetadata = {
      ...(order.metadata ?? {}),
      previous_status: customStatus,
    }

    await orderService.updateOrders({ id: orderId, metadata: nextMetadata } as any)

    logger.info(
      {
        order_id: orderId,
        tenant_id: order.metadata?.business_id ?? null,
        from_status: previousStatus ?? null,
        to_status: customStatus,
      },
      "order-status-changed: order status updated"
    )
  } catch (error) {
    logger.error(
      { order_id: orderId, error: error instanceof Error ? error.message : String(error) },
      "order-status-changed: error processing order"
    )
  }
}

/**
 * Trigger appropriate notifications based on order status
 */
async function triggerNotifications(
  logger: ReturnType<typeof getLogger>,
  orderId: string,
  status: string,
  order: any
): Promise<void> {
  // Note: In a real implementation, you would integrate with
  // a notification service (email, SMS, push)

  switch (status) {
    case "consult_pending":
      // Notify patient that consultation is pending
      logger.info({ order_id: orderId }, "notification: consultation pending")
      break

    case "consult_complete":
      // Notify patient that consultation approved, order processing
      logger.info({ order_id: orderId }, "notification: consultation approved")
      break

    case "consult_rejected":
      // Notify patient that consultation rejected, order cancelled
      logger.info({ order_id: orderId }, "notification: consultation rejected")
      break

    case "processing":
      // Notify patient that order is being prepared
      logger.info({ order_id: orderId }, "notification: order processing")
      break

    case "fulfilled":
      // Notify patient that order has shipped/ready for pickup
      logger.info({ order_id: orderId }, "notification: order fulfilled")
      break

    case "delivered":
      // Notify patient of delivery, request confirmation
      logger.info({ order_id: orderId }, "notification: order delivered")
      break

    case "cancelled":
      // Notify patient of cancellation
      logger.info({ order_id: orderId }, "notification: order cancelled")
      break

    case "refunded":
      // Notify patient of refund
      logger.info({ order_id: orderId }, "notification: order refunded")
      break

    default:
      break
  }
}

export const config: SubscriberConfig = {
  event: "order.updated",
}
