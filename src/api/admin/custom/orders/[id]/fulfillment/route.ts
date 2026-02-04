/**
 * Admin Custom Order Fulfillment Status (PLAN)
 *
 * POST /admin/custom/orders/:id/fulfillment
 *
 * Implements the PLAN fulfillment state machine:
 * pending → in_production → shipped → delivered
 *
 * Rules:
 * - Mark as shipped requires `tracking_number`.
 * - Updates `order.metadata.fulfillment_status` and tracking fields.
 * - On delivered, triggers `financials.makeEarningsAvailable(orderId)` to unlock payouts.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../../../../../modules/business"
import { FINANCIALS_MODULE } from "../../../../../../modules/financials"
import {
  derivePlanStatusFromOrder,
  getOptionalTenantBusinessId,
  validateNextStatus,
  type PlanOrderStatus,
} from "../../_helpers"

function getAuthActor(req: MedusaRequest): {
  actor_type: string
  actor_id: string
  actor_email: string | null
  ip_address: string | null
  user_agent: string | null
} {
  const auth = (req as any).auth_context as any
  const actorId = auth?.actor_id || "unknown"
  const actorTypeRaw = auth?.actor_type || "business_user"
  const actorType = actorTypeRaw === "user" ? "business_user" : actorTypeRaw
  return {
    actor_type: actorType,
    actor_id: actorId,
    actor_email: auth?.actor_email ?? null,
    ip_address:
      ((req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
        (req as any).request_context?.ip_address ??
        (req as any).ip ??
        null),
    user_agent: (req.headers["user-agent"] as string | undefined) ?? null,
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { id } = req.params
    const body = (req.body ?? {}) as Record<string, any>

    const next = (typeof body.status === "string" ? body.status.trim() : "") as PlanOrderStatus
    if (!["pending", "in_production", "shipped", "delivered", "cancelled"].includes(next)) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "status must be one of: pending, in_production, shipped, delivered, cancelled",
      })
    }

    const trackingNumber = typeof body.tracking_number === "string" ? body.tracking_number.trim() : ""
    const carrier = typeof body.carrier === "string" ? body.carrier.trim() : ""

    const orderService = req.scope.resolve(Modules.ORDER) as any
    const businessService = req.scope.resolve(BUSINESS_MODULE) as any
    const financialsService = req.scope.resolve(FINANCIALS_MODULE) as any
    const complianceService = req.scope.resolve("complianceModuleService") as any

    const order = await orderService.retrieveOrder(id, { relations: ["items", "shipping_address"] })
    if (!order) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Order not found" })
    }

    const tenantBusinessId = getOptionalTenantBusinessId(req)
    const businessId = (order?.metadata?.business_id as string | undefined) || null
    if (tenantBusinessId && businessId && businessId !== tenantBusinessId) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Order not found" })
    }

    const from = derivePlanStatusFromOrder(order)
    if (!validateNextStatus(from, next)) {
      return res.status(409).json({
        code: "INVALID_STATE_TRANSITION",
        message: `Invalid transition from ${from} to ${next}`,
      })
    }

    if (next === "shipped" && !trackingNumber) {
      return res.status(400).json({
        code: "TRACKING_REQUIRED",
        message: "tracking_number is required when marking an order as shipped",
      })
    }

    const before = {
      fulfillment_status: (order.metadata?.fulfillment_status as string | undefined) ?? null,
      tracking_number: (order.metadata?.tracking_number as string | undefined) ?? null,
      carrier: (order.metadata?.carrier as string | undefined) ?? null,
    }

    const nextMetadata = {
      ...(order.metadata || {}),
      fulfillment_status: next,
      status_updated_at: new Date().toISOString(),
      ...(next === "shipped"
        ? {
            tracking_number: trackingNumber,
            carrier: carrier || (order.metadata?.carrier as any) || null,
            shipped_at: new Date().toISOString(),
          }
        : {}),
      ...(next === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
    }

    let updated: any
    try {
      const updatedRes = await orderService.updateOrders([{ id, metadata: nextMetadata }])
      updated = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes
    } catch (e) {
      throw new Error(`updateOrders failed: ${e instanceof Error ? e.message : "Unknown error"}`)
    }

    if (!businessId) {
      throw new Error("business_id is required to record order status history")
    }

    try {
      await businessService.createOrderStatusEvents({
        order_id: id,
        business_id: businessId,
        from_status: from,
        to_status: next,
        changed_by: (req as any).auth_context?.actor_id || "unknown",
        reason: null,
        metadata: {
          tracking_number: trackingNumber || null,
          carrier: carrier || null,
        },
      })
    } catch (e) {
      throw new Error(`createOrderStatusEvents failed: ${e instanceof Error ? e.message : "Unknown error"}`)
    }

    if (next === "delivered") {
      try {
        await financialsService.makeEarningsAvailable(id)
      } catch (e) {
        throw new Error(`makeEarningsAvailable failed: ${e instanceof Error ? e.message : "Unknown error"}`)
      }
    }

    const actor = getAuthActor(req)
    try {
      await complianceService?.logAuditEvent?.({
        actor_type: actor.actor_type,
        actor_id: actor.actor_id,
        actor_email: actor.actor_email,
        ip_address: actor.ip_address,
        user_agent: actor.user_agent,
        action: "update",
        entity_type: "order",
        entity_id: id,
        business_id: businessId,
        order_id: id,
        changes: {
          before,
          after: {
            fulfillment_status: next,
            tracking_number: trackingNumber || before.tracking_number,
            carrier: carrier || before.carrier,
          },
        },
        metadata: { event: "order_fulfillment_status_update", from, to: next },
        risk_level: "medium",
      })
    } catch (e) {
      throw new Error(`logAuditEvent failed: ${e instanceof Error ? e.message : "Unknown error"}`)
    }

    return res.json({
      success: true,
      order: updated,
      plan_status: derivePlanStatusFromOrder(updated),
    })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to update fulfillment status",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
