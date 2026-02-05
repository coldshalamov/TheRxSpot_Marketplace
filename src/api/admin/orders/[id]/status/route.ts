import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { orderStatusTransitionWorkflow } from "../../../../../workflows/order-lifecycle"

interface StatusUpdateBody {
  status: string
  reason?: string
}

// Valid order statuses
const VALID_STATUSES = [
  "pending",
  "consult_pending",
  "consult_complete",
  "consult_rejected",
  "payment_captured",
  "processing",
  "fulfilled",
  "delivered",
  "cancelled",
  "refunded",
]

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { id } = req.params
    const { status: newStatus, reason } = req.body as StatusUpdateBody

    // Validate status
    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      })
    }

    // Get order to determine current status
    const orderService = req.scope.resolve(Modules.ORDER)
    const order = await orderService.retrieveOrder(id)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    // Get current custom status from metadata or derive from order status
    const currentStatus =
      (order.metadata?.custom_status as string) || getStatusFromOrder(order)

    // Prevent transition to same status
    if (currentStatus === newStatus) {
      return res.status(400).json({
        message: `Order is already in status: ${newStatus}`,
      })
    }

    // Get current user
    const changedBy = (req as any).auth_context?.auth_identity_id ?? "admin"

    // Execute workflow
    const result = (await orderStatusTransitionWorkflow(req.scope).run({
      input: {
        orderId: id,
        fromStatus: currentStatus,
        toStatus: newStatus,
        changedBy,
        reason,
      },
    })) as any

    res.json({
      success: result.success,
      order_id: id,
      from_status: currentStatus,
      to_status: newStatus,
      earnings_updated: result.earningsUpdated,
      earnings_cancelled: result.earningsCancelled,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ message: "Order not found" })
    }
    if (
      error instanceof Error &&
      (error.message.includes("Invalid status transition") ||
        error.message.includes("Status mismatch"))
    ) {
      return res.status(400).json({ message: error.message })
    }
    res.status(500).json({
      message: "Failed to update order status",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

/**
 * Helper to derive custom status from Medusa order status
 */
function getStatusFromOrder(order: any): string {
  // Map Medusa order status to our custom status
  if (order.status === "pending") {
    return "pending"
  }
  if (order.status === "completed") {
    return "delivered"
  }
  if (order.status === "canceled") {
    return "cancelled"
  }
  if (order.payment_status === "captured") {
    return "payment_captured"
  }
  if (order.fulfillment_status === "fulfilled") {
    return "fulfilled"
  }
  // Default fallback
  return "pending"
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { id } = req.params

    const orderService = req.scope.resolve(Modules.ORDER)
    const order = await orderService.retrieveOrder(id)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    const currentStatus =
      (order.metadata?.custom_status as string) || getStatusFromOrder(order)

    res.json({
      order_id: id,
      current_status: currentStatus,
      medusa_status: order.status,
      payment_status: (order as any).payment_status,
      fulfillment_status: (order as any).fulfillment_status,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ message: "Order not found" })
    }
    res.status(500).json({
      message: "Failed to fetch order status",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
