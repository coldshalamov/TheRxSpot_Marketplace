import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { FINANCIALS_MODULE } from "../modules/financials"
import { getLogger } from "../utils/logger"

/**
 * Handler for order delivered status
 * - Makes earnings available for payout
 */
export default async function orderDeliveredHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const { id: orderId } = event.data

  const orderService = container.resolve(Modules.ORDER)
  const financialsService = container.resolve(FINANCIALS_MODULE)
  const logger = getLogger()

  try {
    // Fetch order
    const order = await orderService.retrieveOrder(orderId)

    if (!order) {
      logger.error({ order_id: orderId }, "order-delivered: order not found")
      return
    }

    const customStatus = order.metadata?.custom_status as string | undefined

    // Only process if status is delivered
    if (customStatus !== "delivered") {
      return
    }

    // Make earnings available
    await financialsService.makeEarningsAvailable(orderId)

    logger.info(
      { order_id: orderId },
      "order-delivered: earnings now available"
    )
  } catch (error) {
    logger.error(
      { order_id: orderId, error: error instanceof Error ? error.message : String(error) },
      "order-delivered: error processing order"
    )
  }
}

// Listen to both the specific event and order.updated for completeness
export const config: SubscriberConfig = {
  event: ["order.delivered", "order.updated"],
}
