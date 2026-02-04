/**
 * Admin Earnings Export (PLAN)
 *
 * GET /admin/earnings/export
 *
 * Returns CSV for the current filter set.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../../modules/financials"

function parseCommaList(value?: string): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

function mapPlanStatusToInternal(status: string): string[] {
  const s = status.trim().toLowerCase()
  if (s === "completed") return ["available", "paid"]
  if (s === "pending") return ["pending"]
  if (s === "paid_out") return ["paid_out"]
  if (s === "refunded") return ["reversed"]
  return [status]
}

function mapPlanTypeToInternal(type: string): string[] {
  const t = type.trim().toLowerCase()
  if (t === "commission") return ["product_sale", "platform_fee"]
  if (t === "consult_fee" || t === "consultation_fee") return ["consultation_fee"]
  if (t === "service_fee") return ["shipping_fee", "clinician_fee"]
  return [type]
}

function asCents(value: any): number {
  if (value == null) return 0
  if (typeof value === "number") return Math.trunc(value)
  if (typeof value === "string") return parseInt(value, 10) || 0
  if (typeof value === "object" && typeof value.value === "string") return parseInt(value.value, 10) || 0
  return Number(value) || 0
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
    const financialsService = req.scope.resolve(FINANCIALS_MODULE) as any
    const query = req.query as Record<string, any>

    const businessIds = parseCommaList(query.business_ids || query.business_id)
    const statuses = parseCommaList(query.status).flatMap(mapPlanStatusToInternal)
    const types = parseCommaList(query.type).flatMap(mapPlanTypeToInternal)
    const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : ""

    const filters: any = {}
    if (businessIds.length === 1) filters.business_id = businessIds[0]
    else if (businessIds.length > 1) filters.business_id = businessIds
    if (statuses.length) filters.status = Array.from(new Set(statuses))
    if (types.length) filters.type = Array.from(new Set(types))
    if (query.date_from || query.date_to) {
      filters.created_at = {}
      if (query.date_from) filters.created_at.$gte = new Date(String(query.date_from))
      if (query.date_to) filters.created_at.$lte = new Date(String(query.date_to))
    }

    const [earnings] = await financialsService.listAndCountEarningEntries(filters, {
      take: 10000,
      skip: 0,
      order: { created_at: "DESC" },
    })

    let rows = (earnings || []) as any[]
    if (q) {
      rows = rows.filter((e) => {
        const id = `${e?.id || ""}`.toLowerCase()
        const orderId = `${e?.order_id || ""}`.toLowerCase()
        return id.includes(q) || orderId.includes(q)
      })
    }

    const header = [
      "earning_id",
      "business_id",
      "order_id",
      "created_at",
      "type",
      "status",
      "gross_amount_cents",
      "platform_fee_cents",
      "processing_fee_cents",
      "net_amount_cents",
      "payout_id",
    ]

    const lines = [header.join(",")]
    for (const e of rows) {
      lines.push(
        [
          csvEscape(e.id),
          csvEscape(e.business_id),
          csvEscape(e.order_id || ""),
          csvEscape(e.created_at ? new Date(e.created_at).toISOString() : ""),
          csvEscape(e.type),
          csvEscape(e.status),
          csvEscape(asCents(e.gross_amount)),
          csvEscape(asCents(e.platform_fee)),
          csvEscape(asCents(e.payment_processing_fee)),
          csvEscape(asCents(e.net_amount)),
          csvEscape(e.payout_id || ""),
        ].join(",")
      )
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename=\"earnings_export.csv\"`)
    return res.send(lines.join("\n"))
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to export earnings",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

