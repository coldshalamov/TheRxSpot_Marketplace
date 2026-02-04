/**
 * Admin Orders Export (PLAN)
 *
 * GET /admin/custom/orders/export
 *
 * Returns CSV for the current filter set, optionally restricted to selected ids.
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

function csvEscape(value: any): string {
  const str = value == null ? "" : String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const orderService = req.scope.resolve(Modules.ORDER) as any
    const businessService = req.scope.resolve(BUSINESS_MODULE) as any

    const query = req.query as Record<string, any>
    const q = typeof query.q === "string" ? query.q.trim() : ""
    const statuses = parseCommaList(query.status) as PlanOrderStatus[]
    const ids = parseCommaList(query.ids)

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

    const scanTarget = 10000
    const filters: any = {}
    if (dateFrom || dateTo) {
      filters.created_at = {}
      if (dateFrom) filters.created_at.$gte = dateFrom
      if (dateTo) filters.created_at.$lte = dateTo
    }
    if (ids.length) {
      filters.id = ids
    }

    const [orders] = await orderService.listAndCountOrders(filters, {
      take: scanTarget,
      skip: 0,
      order: { created_at: "DESC" },
      select: ["id", "display_id", "created_at", "currency_code", "total", "metadata", "email"],
      relations: ["items"],
    })

    const bizIds = unique((orders || []).map((o: any) => o?.metadata?.business_id as string | undefined))
    const businesses = bizIds.length
      ? ((await businessService
          .listBusinesses({ id: bizIds }, { take: bizIds.length })
          .catch(() => [])) as any[])
      : ([] as any[])
    const bizById = new Map<string, any>((businesses || []).map((b: any) => [b.id, b]))

    let rows = (orders || []).map((o: any) => {
      const businessId = (o?.metadata?.business_id as string | undefined) || null
      const business = businessId ? (bizById.get(businessId) as any) ?? null : null
      return {
        id: o.id,
        display_id: o.display_id ?? null,
        created_at: o.created_at ?? null,
        total: o.total ?? 0,
        currency_code: o.currency_code ?? "usd",
        plan_status: derivePlanStatusFromOrder(o),
        business_id: businessId,
        business_name: business?.name || "",
        tracking_number: o?.metadata?.tracking_number || "",
        carrier: o?.metadata?.carrier || "",
        email: o.email || o?.metadata?.email || "",
        items_text: (o.items || []).map((it: any) => it.title).join(" | "),
        item_product_ids: (o.items || []).map((it: any) => it.product_id).filter(Boolean),
      }
    })

    if (effectiveBusinessId) rows = rows.filter((r: any) => r.business_id === effectiveBusinessId)
    if (statuses.length) {
      const set = new Set(statuses)
      rows = rows.filter((r: any) => set.has(r.plan_status))
    }
    if (productId) rows = rows.filter((r: any) => (r.item_product_ids || []).includes(productId))
    if (minTotal != null && Number.isFinite(minTotal as any)) rows = rows.filter((r: any) => (r.total ?? 0) >= (minTotal as any))
    if (maxTotal != null && Number.isFinite(maxTotal as any)) rows = rows.filter((r: any) => (r.total ?? 0) <= (maxTotal as any))

    if (q) {
      const qq = normalizeText(q)
      rows = rows.filter((r: any) => {
        if (normalizeText(r.id).includes(qq)) return true
        if (`${r.display_id ?? ""}`.includes(qq)) return true
        if (normalizeText(r.business_name).includes(qq)) return true
        if (normalizeText(r.email).includes(qq)) return true
        if (normalizeText(r.items_text).includes(qq)) return true
        return false
      })
    }

    const header = [
      "order_id",
      "display_id",
      "created_at",
      "business_id",
      "business_name",
      "email",
      "currency",
      "total_cents",
      "plan_status",
      "carrier",
      "tracking_number",
      "items",
    ]

    const lines = [header.join(",")]
    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.id),
          csvEscape(r.display_id ?? ""),
          csvEscape(r.created_at ? new Date(r.created_at).toISOString() : ""),
          csvEscape(r.business_id ?? ""),
          csvEscape(r.business_name ?? ""),
          csvEscape(r.email ?? ""),
          csvEscape(r.currency_code ?? "usd"),
          csvEscape(r.total ?? 0),
          csvEscape(r.plan_status ?? ""),
          csvEscape(r.carrier ?? ""),
          csvEscape(r.tracking_number ?? ""),
          csvEscape(r.items_text ?? ""),
        ].join(",")
      )
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename=\"orders_export.csv\"`)
    return res.send(lines.join("\n"))
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to export orders",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
