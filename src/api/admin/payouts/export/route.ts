/**
 * Admin Payouts Export (PLAN)
 *
 * GET /admin/payouts/export
 *
 * Returns printable HTML (use browser print dialog to "Save as PDF").
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

function htmlEscape(value: any): string {
  const str = value == null ? "" : String(value)
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function asCents(value: any): number {
  if (value == null) return 0
  if (typeof value === "number") return Math.trunc(value)
  if (typeof value === "string") return parseInt(value, 10) || 0
  if (typeof value === "object" && typeof value.value === "string") return parseInt(value.value, 10) || 0
  return Number(value) || 0
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const financialsService = req.scope.resolve(FINANCIALS_MODULE) as any
    const query = req.query as Record<string, any>

    const businessIds = parseCommaList(query.business_ids || query.business_id)
    const statuses = parseCommaList(query.status)

    const filters: any = {}
    if (businessIds.length === 1) filters.business_id = businessIds[0]
    else if (businessIds.length > 1) filters.business_id = businessIds
    if (statuses.length === 1) filters.status = statuses[0]
    else if (statuses.length > 1) filters.status = statuses

    const [payouts] = await financialsService.listAndCountPayouts(filters, {
      take: 1000,
      skip: 0,
      order: { created_at: "DESC" },
    })

    const title = "Payout History Export"

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${htmlEscape(title)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 24px; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
      th { background: #f6f6f6; }
      .muted { color: #666; }
    </style>
  </head>
  <body>
    <h1>${htmlEscape(title)}</h1>
    <div class="meta">Printable HTML export (use browser print dialog to "Save as PDF").</div>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Business</th>
          <th>Date Requested</th>
          <th>Amount (net)</th>
          <th>Method</th>
          <th>Status</th>
          <th>Arrival</th>
        </tr>
      </thead>
      <tbody>
        ${(payouts || [])
          .map((p: any) => {
            const requested = p.requested_at ? new Date(p.requested_at).toISOString() : "-"
            const arrival = p.completed_at ? new Date(p.completed_at).toISOString() : "-"
            const status = p.status === "processing" ? "in_transit" : p.status
            return `<tr>
              <td>${htmlEscape(p.id)}</td>
              <td>${htmlEscape(p.business_id)}</td>
              <td>${htmlEscape(requested)}</td>
              <td>${htmlEscape(asCents(p.net_amount))}</td>
              <td>${htmlEscape(p.method)}</td>
              <td>${htmlEscape(status)}</td>
              <td>${htmlEscape(arrival)}</td>
            </tr>`
          })
          .join("\n")}
      </tbody>
    </table>
    <div class="meta muted" style="margin-top: 16px;">Placeholder export: replace with PDF generation if needed.</div>
  </body>
</html>`

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.send(html)
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to export payouts",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
