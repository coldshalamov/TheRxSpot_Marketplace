/**
 * Admin Custom Orders Bulk Fulfillment (PLAN)
 *
 * POST /admin/custom/orders/bulk/fulfillment
 *
 * Minimal viable bulk status update for the Orders Page Expansion.
 * Currently supports bulk marking orders as `in_production`.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../../../../../modules/business"
import {
  derivePlanStatusFromOrder,
  getOptionalTenantBusinessId,
  validateNextStatus,
  type PlanOrderStatus,
} from "../../_helpers"

function getActorId(req: MedusaRequest): string {
  const auth = (req as any).auth_context as any
  return auth?.actor_id || "unknown"
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (req.body ?? {}) as Record<string, any>
    const orderIds = Array.isArray(body.order_ids) ? body.order_ids.filter((x) => typeof x === "string") : []
    const next = (typeof body.status === "string" ? body.status.trim() : "") as PlanOrderStatus

    if (!orderIds.length) {
      return res.status(400).json({ code: "INVALID_INPUT", message: "order_ids is required" })
    }

    // Keep this endpoint intentionally scoped for now: it covers the PLAN's common bulk action.
    if (next !== "in_production") {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "Only status=in_production is supported for bulk updates (minimal viable).",
      })
    }

    const orderService = req.scope.resolve(Modules.ORDER) as any
    const businessService = req.scope.resolve(BUSINESS_MODULE) as any
    const complianceService = req.scope.resolve("complianceModuleService") as any

    const tenantBusinessId = getOptionalTenantBusinessId(req)

    const orders = await Promise.all(
      orderIds.map((id: string) => orderService.retrieveOrder(id).catch(() => null))
    )

    const found = (orders || []).filter(Boolean) as any[]
    if (!found.length) {
      return res.status(404).json({ code: "NOT_FOUND", message: "No orders found" })
    }

    if (tenantBusinessId) {
      const forbidden = found.find((o: any) => o?.metadata?.business_id && o.metadata.business_id !== tenantBusinessId)
      if (forbidden) {
        return res.status(404).json({ code: "NOT_FOUND", message: "Order not found" })
      }
    }

    const invalid: { id: string; from: PlanOrderStatus }[] = []
    const updates: { id: string; metadata: any; business_id: string }[] = []

    for (const order of found) {
      const from = derivePlanStatusFromOrder(order)
      if (!validateNextStatus(from, next)) {
        invalid.push({ id: order.id, from })
        continue
      }

      const businessId = (order?.metadata?.business_id as string | undefined) || ""
      if (!businessId) {
        invalid.push({ id: order.id, from })
        continue
      }

      updates.push({
        id: order.id,
        business_id: businessId,
        metadata: {
          ...(order.metadata || {}),
          fulfillment_status: next,
          status_updated_at: new Date().toISOString(),
        },
      })
    }

    if (invalid.length) {
      return res.status(409).json({
        code: "INVALID_STATE_TRANSITION",
        message: "One or more orders are not eligible for this transition",
        details: invalid,
      })
    }

    await orderService.updateOrders(updates.map((u) => ({ id: u.id, metadata: u.metadata })))

    // Record status history + audit logs per order
    const actorId = getActorId(req)
    for (const u of updates) {
      await businessService.createOrderStatusEvents({
        order_id: u.id,
        business_id: u.business_id,
        from_status: "pending",
        to_status: next,
        changed_by: actorId,
        reason: "bulk_update",
        metadata: { bulk: true },
      })
    }

    try {
      await complianceService?.logAuditEvent?.({
        actor_type: ((req as any).auth_context?.actor_type || "business_user") === "user" ? "business_user" : (req as any).auth_context?.actor_type || "business_user",
        actor_id: actorId,
        actor_email: (req as any).auth_context?.actor_email ?? null,
        ip_address: ((req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? (req as any).ip ?? null),
        user_agent: (req.headers["user-agent"] as string | undefined) ?? null,
        action: "update",
        entity_type: "order",
        entity_id: "bulk",
        business_id: tenantBusinessId ?? null,
        changes: { before: null, after: { status: next, order_ids: orderIds } },
        metadata: { event: "order_bulk_fulfillment_update" },
        risk_level: "medium",
      })
    } catch {
      // best-effort
    }

    return res.json({ success: true, updated: updates.length })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to bulk update orders",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

