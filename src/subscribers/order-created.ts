import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { FINANCIALS_MODULE } from "../modules/financials"
import { BUSINESS_MODULE } from "../modules/business"
import { getLogger } from "../utils/logger"

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
  const logger = getLogger()

  try {
    // Fetch order with items
    const order = await orderService.retrieveOrder(orderId, {
      relations: ["items", "items.variant", "items.variant.product"],
    })

    if (!order) {
      logger.error({ order_id: orderId }, "order-created: order not found")
      return
    }

    // Check if order requires consultation
    // This can be determined by product metadata or category
    let requiresConsultation = false
    const consultRequiredProductIds: string[] = []

    for (const item of (order.items ?? []) as any[]) {
      const product = item?.variant?.product ?? item?.product
      const requires =
        product?.metadata?.requires_consult === true ||
        product?.metadata?.requires_consultation === true

      if (requires) {
        const productId = product?.id ?? item?.product_id
        if (typeof productId === "string" && productId.trim()) {
          consultRequiredProductIds.push(productId.trim())
        }
      }
    }

    requiresConsultation = consultRequiredProductIds.length > 0

    // Determine initial status
    const initialStatus = requiresConsultation ? "consult_pending" : "pending"

    // Set custom status in order metadata
    const nextMetadata = {
      ...(order.metadata ?? {}),
      custom_status: initialStatus,
      requires_consultation: requiresConsultation,
      consult_required_product_ids: consultRequiredProductIds,
      status_updated_at: new Date().toISOString(),
    }

    await orderService.updateOrders({ id: orderId, metadata: nextMetadata } as any)

    // Create OrderStatusEvent record
    const businessId = String((nextMetadata as any).business_id ?? "")
    if (!businessId) {
      logger.error(
        { order_id: orderId },
        "order-created: missing metadata.business_id; skipping OrderStatusEvent creation"
      )
      return
    }

    await businessService.createOrderStatusEvents({
      order_id: orderId,
      business_id: businessId,
      from_status: "pending",
      to_status: initialStatus,
      triggered_by: "system",
      reason: requiresConsultation
        ? "Order contains items requiring consultation"
        : "Standard order created",
      metadata: {
        requires_consultation: requiresConsultation,
      },
    })

    logger.info(
      { order_id: orderId, tenant_id: businessId, status: initialStatus },
      "order-created: order initialized"
    )
  } catch (error) {
    logger.error(
      { order_id: orderId, error: error instanceof Error ? error.message : String(error) },
      "order-created: error processing order"
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.created",
}
