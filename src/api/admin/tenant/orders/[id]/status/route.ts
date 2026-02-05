import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { orderStatusTransitionWorkflow } from "../../../../../../workflows/order-lifecycle"
import { z } from "zod"
import { runWorkflowOrThrow } from "../../../../../../utils/workflow"

interface StatusUpdateBody {
  status: string
  reason?: string
}

// Valid order statuses - tenant can only update to certain statuses
const ALLOWED_TENANT_STATUSES = [
  "processing",
  "fulfilled",
  "delivered",
]

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
    const tenantContext = (req as any).tenant_context
    if (!tenantContext) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    const { id } = req.params

    const BodySchema = z
      .object({
        status: z.string().min(1),
        reason: z.string().optional(),
      })
      .strict()

    const parsed = BodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body" })
    }

    const { status: newStatus, reason } = parsed.data as StatusUpdateBody

    // Validate status
    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      })
    }

    // Verify tenant has access to this order
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "status", "metadata", "business.id"],
      filters: {
        id,
      },
    })

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "Order not found" })
    }

    const order = orders[0]
    if (order.business?.id !== tenantContext.business_id) {
      return res.status(404).json({ message: "Order not found" })
    }

    // Get current custom status
    const currentStatus =
      (order.metadata?.custom_status as string) || getStatusFromOrder(order)

    // Prevent transition to same status
    if (currentStatus === newStatus) {
      return res.status(400).json({
        message: `Order is already in status: ${newStatus}`,
      })
    }

    // Restrict certain status transitions for tenants
    // Tenants can generally only move forward in the fulfillment flow
    if (!ALLOWED_TENANT_STATUSES.includes(newStatus)) {
      return res.status(403).json({
        message: `Tenant cannot set order to status: ${newStatus}. Allowed: ${ALLOWED_TENANT_STATUSES.join(", ")}`,
      })
    }

    // Get current user
    const changedBy = (req as any).auth_context?.auth_identity_id ?? null

    // Execute workflow
    const result = (await runWorkflowOrThrow(orderStatusTransitionWorkflow(req.scope), {
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

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const tenantContext = (req as any).tenant_context
    if (!tenantContext) {
      return res.status(401).json({ message: "Not authenticated" })
    }

    const { id } = req.params

    // Verify tenant has access to this order
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "status", "metadata", "business.id"],
      filters: {
        id,
      },
    })

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "Order not found" })
    }

    const order = orders[0]
    if (order.business?.id !== tenantContext.business_id) {
      return res.status(404).json({ message: "Order not found" })
    }
    const currentStatus =
      (order.metadata?.custom_status as string) || getStatusFromOrder(order)

    res.json({
      order_id: id,
      current_status: currentStatus,
      medusa_status: order.status,
    })
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch order status",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

/**
 * Helper to derive custom status from Medusa order status
 */
function getStatusFromOrder(order: any): string {
  if (order.status === "pending") return "pending"
  if (order.status === "completed") return "delivered"
  if (order.status === "canceled") return "cancelled"
  if (order.payment_status === "captured") return "payment_captured"
  if (order.fulfillment_status === "fulfilled") return "fulfilled"
  return "pending"
}
