import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"
import { BUSINESS_MODULE } from "../../../../../modules/business"
import {
  asInt,
  derivePlanType,
  extractStateFromSubmission,
  getAuthActor,
  getOptionalTenantBusinessId,
  getPlanStatus,
  modeToPlanMode,
  parseCommaList,
  parseIsoDate,
  planModeToInternalModes,
  type PlanMode,
  type PlanStatus,
  type PlanType,
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

function htmlEscape(value: any): string {
  const str = value == null ? "" : String(value)
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    try {
      const query = req.query as Record<string, any>

      const statuses = parseCommaList(query.status) as PlanStatus[]
      const modes = parseCommaList(query.mode) as PlanMode[]
      const type = (typeof query.type === "string" ? query.type.trim() : "") as PlanType | ""
      const state = typeof query.state === "string" ? query.state.trim().toUpperCase() : ""
      const ids = parseCommaList(query.ids)

      if (type && !["initial", "follow-up"].includes(type)) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "type must be one of: initial, follow-up" })
      }

      const dateFrom = parseIsoDate(typeof query.date_from === "string" ? query.date_from : undefined)
      const dateTo = parseIsoDate(typeof query.date_to === "string" ? query.date_to : undefined)
      if (query.date_from && !dateFrom) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "date_from must be a valid ISO date string" })
      }
      if (query.date_to && !dateTo) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "date_to must be a valid ISO date string" })
      }

      const businessIdRaw = typeof query.business_id === "string" ? query.business_id.trim() : ""
      const tenantBusinessId = getOptionalTenantBusinessId(req)
      if (tenantBusinessId && businessIdRaw && businessIdRaw !== tenantBusinessId) {
        return res.status(403).json({ code: "FORBIDDEN", message: "business_id is restricted by tenant context" })
      }
      const effectiveBusinessId = tenantBusinessId || businessIdRaw || ""

      const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
      const businessService = req.scope.resolve(BUSINESS_MODULE) as any
      const productService = req.scope.resolve(Modules.PRODUCT) as any
      const complianceService = req.scope.resolve("complianceModuleService") as any

      const scanTarget = Math.min(Math.max(asInt(query.take, 1000), 1), 10000)

      const filters: any = {}
      if (effectiveBusinessId) filters.business_id = effectiveBusinessId
      if (dateFrom || dateTo) {
        filters.scheduled_at = {}
        if (dateFrom) filters.scheduled_at.$gte = dateFrom
        if (dateTo) filters.scheduled_at.$lte = dateTo
      }
      if (ids.length) {
        filters.id = ids
      }
      if (modes.length === 1) {
        const internal = planModeToInternalModes(modes[0]!)
        if (internal.length === 1) filters.mode = internal[0]
      }

      const [consultations] = (await consultationService.listConsultations(filters, {
        take: scanTarget,
        skip: 0,
        order: { created_at: "DESC" },
      })) as [any[], number]

      const patientIds = unique(consultations.map((c) => c.patient_id))
      const clinicianIds = unique(consultations.map((c) => c.clinician_id))
      const businessIds = unique(consultations.map((c) => c.business_id))
      const submissionIds = unique(consultations.map((c) => c.originating_submission_id))

      const patients = await listByIds<any>(consultationService.listPatients.bind(consultationService), patientIds, patientIds.length)
      const clinicians = await listByIds<any>(consultationService.listClinicians.bind(consultationService), clinicianIds, clinicianIds.length)
      const businesses = await listByIds<any>(businessService.listBusinesses.bind(businessService), businessIds, businessIds.length)
      const submissions = await listByIds<any>(businessService.listConsultSubmissions.bind(businessService), submissionIds, submissionIds.length)

      const patientById = new Map(patients.map((p) => [p.id, p]))
      const clinicianById = new Map(clinicians.map((c) => [c.id, c]))
      const businessById = new Map(businesses.map((b) => [b.id, b]))
      const submissionById = new Map(submissions.map((s) => [s.id, s]))

      const productIds = unique(submissions.map((s: any) => s?.product_id).filter(Boolean))
      const products = await listByIds<any>(productService.listProducts.bind(productService), productIds, productIds.length)
      const productById = new Map(products.map((p) => [p.id, p]))

      let rows = consultations.map((consultation: any) => {
        const submission = consultation.originating_submission_id
          ? submissionById.get(consultation.originating_submission_id)
          : null
        const productId = submission?.product_id ?? null
        const product = productId ? productById.get(productId) ?? null : null
        const stateValue = submission ? extractStateFromSubmission(submission) : null

        return {
          id: consultation.id,
          plan_status: getPlanStatus(consultation),
          mode: modeToPlanMode(consultation.mode),
          type: derivePlanType(consultation),
          scheduled_at: consultation.scheduled_at ?? null,
          order_id: consultation.order_id ?? null,
          state: stateValue,
          patient: patientById.get(consultation.patient_id) ?? null,
          clinician: consultation.clinician_id ? clinicianById.get(consultation.clinician_id) ?? null : null,
          business: businessById.get(consultation.business_id) ?? null,
          product,
        }
      })

      if (statuses.length) {
        const set = new Set(statuses)
        rows = rows.filter((r) => set.has(r.plan_status))
      }
      if (modes.length) {
        const set = new Set(modes)
        rows = rows.filter((r) => set.has(r.mode))
      }
      if (type) {
        rows = rows.filter((r) => r.type === type)
      }
      if (state) {
        rows = rows.filter((r) => (r.state || "").toUpperCase() === state)
      }

      const actor = getAuthActor(req)
      await complianceService?.logAuditEvent?.({
        actor_type: actor.actor_type,
        actor_id: actor.actor_id,
        actor_email: actor.actor_email,
        ip_address: actor.ip_address,
        user_agent: actor.user_agent,
        action: "export",
        entity_type: "consultation",
        entity_id: "consultations_export",
        business_id: effectiveBusinessId || null,
        changes: null,
        metadata: {
          exported_count: rows.length,
          ids: ids.length ? ids : null,
          filters: {
            status: statuses.length ? statuses : null,
            mode: modes.length ? modes : null,
            type: type || null,
            state: state || null,
            date_from: dateFrom ? dateFrom.toISOString() : null,
            date_to: dateTo ? dateTo.toISOString() : null,
          },
        },
        risk_level: "low",
      })

      const title = `Consultations Report (${new Date().toISOString().slice(0, 10)})`

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${htmlEscape(title)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; vertical-align: top; }
      th { background: #f7f7f7; text-align: left; }
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
          <th>Client</th>
          <th>Provider</th>
          <th>Business</th>
          <th>Scheduled</th>
          <th>State</th>
          <th>Status</th>
          <th>Mode</th>
          <th>Product</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((r) => {
            const client = [r.patient?.first_name, r.patient?.last_name].filter(Boolean).join(" ") || "-"
            const provider =
              [r.clinician?.first_name, r.clinician?.last_name].filter(Boolean).join(" ") || "Unassigned"
            const businessName = r.business?.name || r.business_id || "-"
            const scheduled = r.scheduled_at ? new Date(r.scheduled_at).toISOString() : "-"
            const productTitle = r.product?.title || "-"
            return `<tr>
              <td>${htmlEscape(r.id)}</td>
              <td>${htmlEscape(client)}</td>
              <td>${htmlEscape(provider)}</td>
              <td>${htmlEscape(businessName)}</td>
              <td>${htmlEscape(scheduled)}</td>
              <td>${htmlEscape(r.state || "-")}</td>
              <td>${htmlEscape(r.plan_status)}</td>
              <td>${htmlEscape(r.mode)}</td>
              <td>${htmlEscape(productTitle)}</td>
              <td>${htmlEscape(r.type)}</td>
            </tr>`
          })
          .join("\n")}
      </tbody>
    </table>
  </body>
</html>`

      res.setHeader("Content-Type", "text/html; charset=utf-8")
      return res.send(html)
    } catch (error) {
      return res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Failed to export consultations report",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
}
