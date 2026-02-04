/**
 * Admin Custom Order Refund (PLAN - stub)
 *
 * POST /admin/custom/orders/:id/refund
 *
 * Payment-provider refunds are not integrated yet. This endpoint exists so the
 * admin UI can present a consistent flow and so audit logging is captured.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { getOptionalTenantBusinessId } from "../../_helpers"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { id } = req.params
    const body = (req.body ?? {}) as Record<string, any>
    const reason = typeof body.reason === "string" ? body.reason.trim() : null

    const orderService = req.scope.resolve(Modules.ORDER) as any
    const complianceService = req.scope.resolve("complianceModuleService") as any

    const order = await orderService.retrieveOrder(id).catch(() => null)
    if (!order) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Order not found" })
    }

    const tenantBusinessId = getOptionalTenantBusinessId(req)
    const businessId = (order?.metadata?.business_id as string | undefined) || null
    if (tenantBusinessId && businessId && businessId !== tenantBusinessId) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Order not found" })
    }

    try {
      await complianceService?.logAuditEvent?.({
        actor_type: ((req as any).auth_context?.actor_type || "business_user") === "user" ? "business_user" : (req as any).auth_context?.actor_type || "business_user",
        actor_id: (req as any).auth_context?.actor_id || "unknown",
        actor_email: (req as any).auth_context?.actor_email ?? null,
        ip_address: ((req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? (req as any).ip ?? null),
        user_agent: (req.headers["user-agent"] as string | undefined) ?? null,
        action: "update",
        entity_type: "order",
        entity_id: id,
        business_id: businessId,
        order_id: id,
        changes: { before: null, after: { requested_refund: true, reason } },
        metadata: { event: "order_refund_requested_stub" },
        risk_level: "high",
      })
    } catch {
      // best-effort
    }

    return res.status(501).json({
      code: "NOT_IMPLEMENTED",
      message: "Refunds require payment provider integration (TODO: Stripe/PaymentProvider).",
    })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to request refund",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
