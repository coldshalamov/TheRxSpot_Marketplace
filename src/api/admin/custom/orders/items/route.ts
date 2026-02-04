/**
 * Admin Custom Order Items (PLAN)
 *
 * GET /admin/custom/orders/items
 *
 * Supports the Orders Page Expansion "Order Items" tab.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../../../../modules/business"
import {
  asInt,
  derivePlanStatusFromOrder,
  getOptionalTenantBusinessId,
  normalizeText,
  parseCommaList,
  parseIsoDate,
  type PlanOrderStatus,
} from "../_helpers"

function unique<T>(values: (T | null | undefined)[]): T[] {
  return Array.from(new Set(values.filter((v): v is T => v != null)))
}

async function listByIds<T>(
  fn: (filters: any, options: any) => Promise<[T[], number] | T[]>,
  ids: string[],
  take: number
): Promise<T[]> {
  if (!ids.length) return []
  const res: any = await fn({ id: ids }, { take })
  return Array.isArray(res?.[0]) ? (res[0] as T[]) : (res as T[])
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const orderService = req.scope.resolve(Modules.ORDER) as any
    const customerService = req.scope.resolve(Modules.CUSTOMER) as any
    const businessService = req.scope.resolve(BUSINESS_MODULE) as any

    const query = req.query as Record<string, any>
    const limit = Math.min(Math.max(asInt(query.limit, 25), 1), 100)
    const offset = Math.max(asInt(query.offset, 0), 0)

    const q = typeof query.q === "string" ? query.q.trim() : ""
    const statuses = parseCommaList(query.status) as PlanOrderStatus[]

    const businessIdRaw = typeof query.business_id === "string" ? query.business_id.trim() : ""
    const tenantBusinessId = getOptionalTenantBusinessId(req)
    if (tenantBusinessId && businessIdRaw && businessIdRaw !== tenantBusinessId) {
      return res.status(403).json({ code: "FORBIDDEN", message: "business_id is restricted by tenant context" })
    }
    const effectiveBusinessId = tenantBusinessId || businessIdRaw || ""

    const productId = typeof query.product_id === "string" ? query.product_id.trim() : ""

    const dateFrom = parseIsoDate(typeof query.date_from === "string" ? query.date_from : undefined)
    const dateTo = parseIsoDate(typeof query.date_to === "string" ? query.date_to : undefined)
    if (query.date_from && !dateFrom) {
      return res.status(400).json({ code: "INVALID_INPUT", message: "date_from must be a valid ISO date string" })
    }
    if (query.date_to && !dateTo) {
      return res.status(400).json({ code: "INVALID_INPUT", message: "date_to must be a valid ISO date string" })
    }

    const minTotal = query.min_total != null ? asInt(query.min_total, NaN as any) : null
    const maxTotal = query.max_total != null ? asInt(query.max_total, NaN as any) : null

    const scanTarget =
      q ||
      statuses.length ||
      effectiveBusinessId ||
      productId ||
      dateFrom ||
      dateTo ||
      minTotal != null ||
      maxTotal != null
        ? 10000
        : Math.min(Math.max(offset + limit, 200), 10000)

    const filters: any = {}
    if (dateFrom || dateTo) {
      filters.created_at = {}
      if (dateFrom) filters.created_at.$gte = dateFrom
      if (dateTo) filters.created_at.$lte = dateTo
    }

    const [orders] = await orderService.listAndCountOrders(filters, {
      take: scanTarget,
      skip: 0,
      order: { created_at: "DESC" },
      select: ["id", "display_id", "created_at", "currency_code", "total", "metadata", "customer_id", "email", "status"],
      relations: ["items"],
    })

    const bizIds = unique<string>((orders || []).map((o: any) => o?.metadata?.business_id as string | undefined))
    const businesses = bizIds.length ? await businessService.listBusinesses({ id: bizIds }, { take: bizIds.length }).catch(() => []) : []
    const bizById = new Map((businesses || []).map((b: any) => [b.id, b]))

    const customerIds = unique<string>((orders || []).map((o: any) => o?.customer_id as string | undefined))
    const customers = await listByIds<any>(customerService.listCustomers.bind(customerService), customerIds, customerIds.length)
    const customerById = new Map((customers || []).map((c: any) => [c.id, c]))

    let rows = (orders || []).map((o: any) => {
      const businessId = (o?.metadata?.business_id as string | undefined) || null
      const business = businessId ? bizById.get(businessId) ?? null : null
      const customer = o.customer_id ? customerById.get(o.customer_id) ?? null : null
      const planStatus = derivePlanStatusFromOrder(o)
      const createdAt = o.created_at ?? null
      const currency = o.currency_code ?? "usd"
      const orderTotal = o.total ?? 0

      const items = (o.items || []).map((it: any) => ({
        id: it.id,
        order_id: o.id,
        order_display_id: o.display_id ?? null,
        business_id: businessId,
        business,
        created_at: createdAt,
        plan_status: planStatus,
        product_id: it.product_id ?? null,
        product_title: it.title ?? "",
        variant_title: it.variant_title ?? null,
        quantity: it.quantity ?? 0,
        unit_price: it.unit_price ?? 0,
        total: it.total ?? 0,
        order_total: orderTotal,
        currency_code: currency,
        customer,
      }))

      return items
    }).flat()

    if (effectiveBusinessId) {
      rows = rows.filter((r: any) => r.business_id === effectiveBusinessId)
    }

    if (statuses.length) {
      const set = new Set(statuses)
      rows = rows.filter((r: any) => set.has(r.plan_status))
    }

    if (productId) {
      rows = rows.filter((r: any) => r.product_id === productId)
    }

    if (minTotal != null && Number.isFinite(minTotal as any)) {
      rows = rows.filter((r: any) => (r.order_total ?? 0) >= (minTotal as any))
    }
    if (maxTotal != null && Number.isFinite(maxTotal as any)) {
      rows = rows.filter((r: any) => (r.order_total ?? 0) <= (maxTotal as any))
    }

    if (q) {
      const qq = normalizeText(q)
      rows = rows.filter((r: any) => {
        if (normalizeText(r.order_id).includes(qq)) return true
        if (`${r.order_display_id ?? ""}`.includes(qq)) return true
        if (normalizeText(r.business?.name || "").includes(qq)) return true
        if (normalizeText(r.customer?.email || r.customer?.id || "").includes(qq)) return true
        if (normalizeText(`${r.customer?.first_name || ""} ${r.customer?.last_name || ""}`).includes(qq)) return true
        if (normalizeText(r.product_title || "").includes(qq)) return true
        if (normalizeText(r.variant_title || "").includes(qq)) return true
        return false
      })
    }

    const count = rows.length
    const page = rows.slice(offset, offset + limit)

    return res.json({
      items: page.map((r: any) => ({
        id: r.id,
        order_id: r.order_id,
        order_display_id: r.order_display_id,
        business_id: r.business_id,
        business: r.business,
        created_at: r.created_at,
        plan_status: r.plan_status,
        product_id: r.product_id,
        product_title: r.product_title,
        variant_title: r.variant_title,
        quantity: r.quantity,
        unit_price: r.unit_price,
        total: r.total,
        currency_code: r.currency_code,
      })),
      count,
      limit,
      offset,
    })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to list order items",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
