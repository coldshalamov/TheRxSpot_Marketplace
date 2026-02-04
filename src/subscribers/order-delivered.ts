import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { FINANCIALS_MODULE } from "../modules/financials"

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

  try {
    // Fetch order
    const order = await orderService.retrieveOrder(orderId)

    if (!order) {
      console.error(`[order-delivered] Order not found: ${orderId}`)
      return
    }

    const customStatus = order.metadata?.custom_status as string | undefined

    // Only process if status is delivered
    if (customStatus !== "delivered") {
      return
    }

    // Make earnings available
    await financialsService.makeEarningsAvailable(orderId)

    console.log(
      `[order-delivered] Earnings for order ${orderId} are now available`
    )
  } catch (error) {
    console.error(
      `[order-delivered] Error processing order ${orderId}:`,
      error instanceof Error ? error.message : error
    )
  }
}

// Listen to both the specific event and order.updated for completeness
export const config: SubscriberConfig = {
  event: ["order.delivered", "order.updated"],
}
