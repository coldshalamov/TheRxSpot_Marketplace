/**
 * Admin Custom Order Detail (PLAN)
 *
 * GET /admin/custom/orders/:id
 *
 * Used by Orders Page Expansion order detail modal.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../../../../modules/business"
import { FINANCIALS_MODULE } from "../../../../../modules/financials"
import { derivePlanStatusFromOrder, getOptionalTenantBusinessId } from "../_helpers"

function asCents(value: any): number {
  if (value == null) return 0
  if (typeof value === "number") return Math.trunc(value)
  if (typeof value === "string") return parseInt(value, 10) || 0
  if (typeof value === "object" && typeof value.value === "string") return parseInt(value.value, 10) || 0
  return Number(value) || 0
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { id } = req.params
    const orderService = req.scope.resolve(Modules.ORDER) as any
    const customerService = req.scope.resolve(Modules.CUSTOMER) as any
    const businessService = req.scope.resolve(BUSINESS_MODULE) as any
    const financialsService = req.scope.resolve(FINANCIALS_MODULE) as any

    const order = await orderService.retrieveOrder(id, {
      relations: ["items", "shipping_address", "billing_address", "shipping_methods", "transactions"],
    })

    if (!order) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Order not found" })
    }

    const tenantBusinessId = getOptionalTenantBusinessId(req)
    const businessId = (order?.metadata?.business_id as string | undefined) || null
    if (tenantBusinessId && businessId && businessId !== tenantBusinessId) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Order not found" })
    }

    const business = businessId ? await businessService.retrieveBusiness(businessId).catch(() => null) : null
    const statusHistory = await businessService.listOrderStatusEventsByOrder(id).catch(() => [])

    const customer = order.customer_id ? await customerService.retrieveCustomer(order.customer_id).catch(() => null) : null

    const earnings = (await financialsService
      .listEarningEntries({ order_id: id }, { order: { created_at: "DESC" } })
      .catch(() => [])) as any[]

    const platformCommission = earnings.reduce((sum, e) => sum + asCents(e.platform_fee), 0)
    const netTotal = earnings.reduce((sum, e) => sum + asCents(e.net_amount), 0)

    // Consultation fee detection (dev-friendly heuristic)
    const consultFees = (order.items || []).filter((it: any) => {
      const t = `${it?.title || ""}`.toLowerCase()
      return it?.metadata?.type === "consultation_fee" || t.includes("consultation fee")
    })

    const consultFeeTotal = consultFees.reduce((sum: number, it: any) => sum + (it.total ?? 0), 0)

    return res.json({
      order: {
        ...order,
        business_id: businessId,
        business,
        plan_status: derivePlanStatusFromOrder(order),
        customer,
        platform_commission_cents: platformCommission,
        net_earnings_cents: netTotal,
        consult_fee_total: consultFeeTotal,
        status_history: statusHistory || [],
      },
    })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to fetch order detail",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
