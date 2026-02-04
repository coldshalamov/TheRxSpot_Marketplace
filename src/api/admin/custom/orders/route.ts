/**
 * Admin Custom Orders (PLAN)
 *
 * GET /admin/custom/orders
 *
 * Used by Orders Page Expansion. Provides cross-tenant order listing with
 * tenant scoping if a business_id exists in the auth context.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../../../modules/business"
import {
  asInt,
  derivePlanStatusFromOrder,
  getOptionalTenantBusinessId,
  normalizeText,
  parseCommaList,
  parseIsoDate,
  type PlanOrderStatus,
} from "./_helpers"

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

    const scanTarget = q || statuses.length || effectiveBusinessId || productId || dateFrom || dateTo || minTotal != null || maxTotal != null
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
      relations: ["items", "shipping_address", "shipping_methods"],
    })

    const bizIds = unique((orders || []).map((o: any) => o?.metadata?.business_id as string | undefined))
    const businesses = bizIds.length
      ? await businessService.listBusinesses({ id: bizIds }, { take: bizIds.length }).catch(() => [])
      : []
    const bizById = new Map((businesses || []).map((b: any) => [b.id, b]))

    const customerIds = unique((orders || []).map((o: any) => o?.customer_id as string | undefined))
    const customers = await listByIds<any>(customerService.listCustomers.bind(customerService), customerIds, customerIds.length)
    const customerById = new Map((customers || []).map((c: any) => [c.id, c]))

    let rows = (orders || []).map((o: any) => {
      const businessId = (o?.metadata?.business_id as string | undefined) || null
      const customer = o.customer_id ? customerById.get(o.customer_id) ?? null : null
      return {
        id: o.id,
        display_id: o.display_id ?? null,
        created_at: o.created_at ?? null,
        total: o.total ?? 0,
        currency_code: o.currency_code ?? "usd",
        plan_status: derivePlanStatusFromOrder(o),
        customer,
        shipping_address: o.shipping_address ?? null,
        business_id: businessId,
        business: businessId ? bizById.get(businessId) ?? null : null,
        items: o.items ?? [],
        metadata: o.metadata ?? {},
      }
    })

    if (effectiveBusinessId) {
      rows = rows.filter((r: any) => r.business_id === effectiveBusinessId)
    }

    if (statuses.length) {
      const set = new Set(statuses)
      rows = rows.filter((r: any) => set.has(r.plan_status))
    }

    if (productId) {
      rows = rows.filter((r: any) => (r.items || []).some((it: any) => it.product_id === productId))
    }

    if (minTotal != null && Number.isFinite(minTotal as any)) {
      rows = rows.filter((r: any) => (r.total ?? 0) >= (minTotal as any))
    }
    if (maxTotal != null && Number.isFinite(maxTotal as any)) {
      rows = rows.filter((r: any) => (r.total ?? 0) <= (maxTotal as any))
    }

    if (q) {
      const qq = normalizeText(q)
      rows = rows.filter((r: any) => {
        if (normalizeText(r.id).includes(qq)) return true
        if (`${r.display_id ?? ""}`.includes(qq)) return true
        const businessName = normalizeText(r.business?.name || "")
        if (businessName.includes(qq)) return true
        const custName = normalizeText(`${r.customer?.first_name || ""} ${r.customer?.last_name || ""}`)
        if (custName.includes(qq)) return true
        const email = normalizeText(r.customer?.email || r.metadata?.email || "")
        if (email.includes(qq)) return true
        const itemTitles = normalizeText((r.items || []).map((it: any) => it.title).join(" "))
        if (itemTitles.includes(qq)) return true
        return false
      })
    }

    const count = rows.length
    const page = rows.slice(offset, offset + limit)

    return res.json({ orders: page, count, limit, offset })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to list orders",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
