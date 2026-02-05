import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CONSULTATION_MODULE } from "../../../../../../modules/consultation"
import { BUSINESS_MODULE } from "../../../../../../modules/business"
import { getAuthActor, getOptionalTenantBusinessId, getPlanStatus, modeToPlanMode, derivePlanType, extractStateFromSubmission } from "../../_helpers"

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
    const { id } = req.params

    const tenantBusinessId = getOptionalTenantBusinessId(req)
    const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
    const businessService = req.scope.resolve(BUSINESS_MODULE) as any
    const productService = req.scope.resolve(Modules.PRODUCT) as any
    const complianceService = req.scope.resolve("complianceModuleService") as any

    let consultation: any
    try {
      consultation = await consultationService.getConsultationOrThrow(id)
    } catch {
      return res.status(404).json({ code: "NOT_FOUND", message: "Consultation not found" })
    }

    if (tenantBusinessId && consultation.business_id !== tenantBusinessId) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Consultation not found" })
    }

    const patient = await consultationService.getPatientOrThrow(consultation.patient_id).catch(() => null)
    const clinician = consultation.clinician_id
      ? await consultationService.getClinicianOrThrow(consultation.clinician_id).catch(() => null)
      : null

    const [businesses] = (await businessService
      .listAndCountBusinesses({ id: consultation.business_id }, { take: 1 })
      .catch(() => [[], 0])) as [any[], number]
    const business = businesses?.[0] ?? null

    const submission = consultation.originating_submission_id
      ? await businessService
          .listConsultSubmissionsDecrypted({ id: consultation.originating_submission_id }, { take: 1 })
          .then((list: any[]) => list?.[0] ?? null)
          .catch(() => null)
      : null

    const state = submission ? extractStateFromSubmission(submission) : null

    let product: any = null
    if (submission?.product_id) {
      try {
        const listed = await productService.listProducts({ id: submission.product_id }, { take: 1 })
        if (Array.isArray(listed?.[0])) {
          product = listed?.[0]?.[0] ?? null
        } else if (Array.isArray(listed)) {
          product = listed?.[0] ?? null
        }
      } catch {
        product = null
      }
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
      entity_id: id,
      business_id: consultation.business_id ?? null,
      consultation_id: id,
      changes: null,
      metadata: { event: "consultation_export" },
      risk_level: "low",
    })

    const title = `Consultation ${id}`
    const client = [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") || "-"
    const provider = [clinician?.first_name, clinician?.last_name].filter(Boolean).join(" ") || "Unassigned"
    const scheduled = consultation.scheduled_at ? new Date(consultation.scheduled_at).toISOString() : "-"
    const planStatus = getPlanStatus(consultation)
    const mode = modeToPlanMode(consultation.mode)
    const consultType = derivePlanType(consultation)
    const productTitle = product?.title || "-"

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${htmlEscape(title)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
      .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: .03em; }
      .value { font-size: 13px; margin-top: 4px; }
      pre { white-space: pre-wrap; word-wrap: break-word; font-size: 12px; background: #fafafa; border: 1px solid #eee; padding: 10px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <h1>${htmlEscape(title)}</h1>
    <div class="meta">Printable HTML export (use browser print dialog to "Save as PDF").</div>

    <div class="grid">
      <div class="card">
        <div class="label">Client</div>
        <div class="value">${htmlEscape(client)}</div>
        <div class="label" style="margin-top:10px;">Email</div>
        <div class="value">${htmlEscape(patient?.email || "-")}</div>
        <div class="label" style="margin-top:10px;">Phone</div>
        <div class="value">${htmlEscape(patient?.phone || "-")}</div>
        <div class="label" style="margin-top:10px;">DOB</div>
        <div class="value">${htmlEscape(patient?.date_of_birth || "-")}</div>
      </div>
      <div class="card">
        <div class="label">Business</div>
        <div class="value">${htmlEscape(business?.name || consultation.business_id || "-")}</div>
        <div class="label" style="margin-top:10px;">Provider</div>
        <div class="value">${htmlEscape(provider)}</div>
        <div class="label" style="margin-top:10px;">Scheduled</div>
        <div class="value">${htmlEscape(scheduled)}</div>
        <div class="label" style="margin-top:10px;">State</div>
        <div class="value">${htmlEscape(state || "-")}</div>
      </div>
    </div>

    <div class="grid" style="margin-top:12px;">
      <div class="card">
        <div class="label">Status</div>
        <div class="value">${htmlEscape(planStatus)}</div>
        <div class="label" style="margin-top:10px;">Mode</div>
        <div class="value">${htmlEscape(mode)}</div>
        <div class="label" style="margin-top:10px;">Type</div>
        <div class="value">${htmlEscape(consultType)}</div>
        <div class="label" style="margin-top:10px;">Product</div>
        <div class="value">${htmlEscape(productTitle)}</div>
      </div>
      <div class="card">
        <div class="label">Chief complaint</div>
        <div class="value">${htmlEscape(consultation.chief_complaint || "-")}</div>
        <div class="label" style="margin-top:10px;">Order ID</div>
        <div class="value">${htmlEscape(consultation.order_id || "-")}</div>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="label">Clinician notes</div>
      <pre>${htmlEscape(consultation.notes || "")}</pre>
    </div>
    <div class="card" style="margin-top:12px;">
      <div class="label">Admin notes</div>
      <pre>${htmlEscape(consultation.admin_notes || "")}</pre>
    </div>
  </body>
</html>`

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.send(html)
}
