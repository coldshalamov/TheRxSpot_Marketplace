/**
 * Admin Packing Slips Export (PLAN)
 *
 * GET /admin/custom/orders/packing-slips/export?ids=...
 *
 * Returns printable HTML (save as PDF) for the selected orders.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../../../../../modules/business"
import { getOptionalTenantBusinessId, parseCommaList } from "../../_helpers"

function esc(value: any): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const orderService = req.scope.resolve(Modules.ORDER) as any
    const businessService = req.scope.resolve(BUSINESS_MODULE) as any

    const ids = parseCommaList((req.query as any)?.ids)
    if (!ids.length) {
      return res.status(400).json({ code: "INVALID_INPUT", message: "ids is required (comma-separated)" })
    }

    const tenantBusinessId = getOptionalTenantBusinessId(req)

    const orders = await Promise.all(
      ids.map((id) =>
        orderService
          .retrieveOrder(id, { relations: ["items", "shipping_address"] })
          .catch(() => null)
      )
    )

    const filtered = (orders || []).filter(Boolean) as any[]
    if (!filtered.length) {
      return res.status(404).json({ code: "NOT_FOUND", message: "No orders found" })
    }

    if (tenantBusinessId) {
      const bad = filtered.find((o) => o?.metadata?.business_id && o.metadata.business_id !== tenantBusinessId)
      if (bad) {
        return res.status(404).json({ code: "NOT_FOUND", message: "Order not found" })
      }
    }

    const bizIds = Array.from(new Set(filtered.map((o) => o?.metadata?.business_id).filter(Boolean)))
    const businesses = bizIds.length
      ? ((await businessService
          .listBusinesses({ id: bizIds }, { take: bizIds.length })
          .catch(() => [])) as any[])
      : ([] as any[])
    const bizById = new Map<string, any>((businesses || []).map((b: any) => [b.id, b]))

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Packing Slips</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color: #111827; }
      .page { page-break-after: always; padding: 24px; }
      .row { display: flex; justify-content: space-between; gap: 24px; }
      .muted { color: #6b7280; font-size: 12px; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      h2 { font-size: 14px; margin: 16px 0 8px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 8px 0; font-size: 12px; }
      th { color: #374151; font-weight: 600; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    </style>
  </head>
  <body>
    ${filtered
      .map((o) => {
        const bizId = o?.metadata?.business_id || ""
        const biz = bizId ? bizById.get(bizId) : null
        const ship = o.shipping_address || {}
        const address = [ship.address_1, ship.address_2, ship.city, ship.province, ship.postal_code, ship.country_code]
          .filter(Boolean)
          .join(", ")
        return `<div class="page">
          <div class="row">
            <div>
              <h1>Packing Slip</h1>
              <div class="muted">Order ID</div>
              <div class="mono">${esc(o.id)}</div>
              <div class="muted" style="margin-top: 8px;">Business</div>
              <div>${esc(biz?.name || bizId || "—")}</div>
            </div>
            <div>
              <div class="muted">Ship to</div>
              <div>${esc(ship.first_name || "")} ${esc(ship.last_name || "")}</div>
              <div class="muted">${esc(address || "—")}</div>
            </div>
          </div>
          <h2>Items</h2>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              ${(o.items || [])
                .map(
                  (it: any) => `<tr>
                    <td>${esc(it.title)}</td>
                    <td class="muted">${esc(it.variant_title || "")}</td>
                    <td>${esc(it.quantity)}</td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>`
      })
      .join("")}
  </body>
</html>`

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.send(html)
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to export packing slips",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
