import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CONSULTATION_MODULE } from "../../../../modules/consultation"
import { BUSINESS_MODULE } from "../../../../modules/business"
import {
  asInt,
  derivePlanType,
  extractStateFromSubmission,
  getOptionalTenantBusinessId,
  getPlanStatus,
  modeToPlanMode,
  normalizeDigits,
  normalizeText,
  parseCommaList,
  parseIsoDate,
  planModeToInternalModes,
  type PlanMode,
  type PlanStatus,
  type PlanType,
} from "./_helpers"

function matchesQuery(row: any, q: string): boolean {
  const query = normalizeText(q)
  if (!query) return true

  const tokens = query.split(/\s+/).filter(Boolean)
  const hay = normalizeText(
    [
      row.id || "",
      row.order_id || "",
      row.patient?.first_name || "",
      row.patient?.last_name || "",
      row.patient?.email || "",
      row.clinician?.first_name || "",
      row.clinician?.last_name || "",
      row.business?.name || "",
      row.product?.title || "",
    ].join(" ")
  )

  const qDigits = normalizeDigits(query)
  const phoneDigits = normalizeDigits(row.patient?.phone || "")

  return (
    tokens.every((t) => {
      const tDigits = normalizeDigits(t)
      if (tDigits.length >= 4) {
        return phoneDigits.includes(tDigits) || hay.includes(normalizeText(t))
      }
      return hay.includes(normalizeText(t))
    }) || (qDigits.length >= 4 && phoneDigits.includes(qDigits))
  )
}

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
      const query = req.query as Record<string, any>

      const limit = Math.min(Math.max(asInt(query.limit, 25), 1), 100)
      const offset = Math.max(asInt(query.offset, 0), 0)

      const q = typeof query.q === "string" ? query.q.trim() : ""

      const statuses = parseCommaList(query.status) as PlanStatus[]
      const modes = parseCommaList(query.mode) as PlanMode[]
      const type = (typeof query.type === "string" ? query.type.trim() : "") as PlanType | ""
      const state = typeof query.state === "string" ? query.state.trim().toUpperCase() : ""

      const businessIdRaw = typeof query.business_id === "string" ? query.business_id.trim() : ""

      if (type && !["initial", "follow-up"].includes(type)) {
        return res.status(400).json({
          code: "INVALID_INPUT",
          message: "type must be one of: initial, follow-up",
        })
      }

      const invalidStatuses = statuses.filter(
        (s) => !["pending", "scheduled", "completed", "approved", "rejected"].includes(s)
      )
      if (invalidStatuses.length) {
        return res.status(400).json({
          code: "INVALID_INPUT",
          message: "status must be one of: pending, scheduled, completed, approved, rejected",
        })
      }

      const invalidModes = modes.filter((m) => !["video", "audio", "form"].includes(m))
      if (invalidModes.length) {
        return res.status(400).json({
          code: "INVALID_INPUT",
          message: "mode must be one of: video, audio, form",
        })
      }

      const dateFrom = parseIsoDate(typeof query.date_from === "string" ? query.date_from : undefined)
      const dateTo = parseIsoDate(typeof query.date_to === "string" ? query.date_to : undefined)
      if (query.date_from && !dateFrom) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "date_from must be a valid ISO date string" })
      }
      if (query.date_to && !dateTo) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "date_to must be a valid ISO date string" })
      }

      const tenantBusinessId = getOptionalTenantBusinessId(req)
      if (tenantBusinessId && businessIdRaw && businessIdRaw !== tenantBusinessId) {
        return res.status(403).json({
          code: "FORBIDDEN",
          message: "business_id is restricted by tenant context",
        })
      }

      const effectiveBusinessId = tenantBusinessId || businessIdRaw || ""

      const scanTarget = q || statuses.length || modes.length || type || state || dateFrom || dateTo
        ? 10000
        : Math.min(Math.max(offset + limit, 200), 10000)

      const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
      const businessService = req.scope.resolve(BUSINESS_MODULE) as any
      const productService = req.scope.resolve(Modules.PRODUCT) as any

      const filters: any = {}
      if (effectiveBusinessId) {
        filters.business_id = effectiveBusinessId
      }
      if (dateFrom || dateTo) {
        filters.scheduled_at = {}
        if (dateFrom) filters.scheduled_at.$gte = dateFrom
        if (dateTo) filters.scheduled_at.$lte = dateTo
      }

      // If filtering by a single internal mode, apply it at the DB layer.
      if (modes.length === 1) {
        const internal = planModeToInternalModes(modes[0]!)
        if (internal.length === 1) {
          filters.mode = internal[0]
        }
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

      const productIds = unique(
        submissions.map((s: any) => s?.product_id).filter(Boolean)
      )
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
          business_id: consultation.business_id,
          order_id: consultation.order_id ?? null,
          scheduled_at: consultation.scheduled_at ?? null,
          updated_at: consultation.updated_at ?? null,
          plan_status: getPlanStatus(consultation),
          mode: modeToPlanMode(consultation.mode),
          type: derivePlanType(consultation),
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

      if (q) {
        rows = rows.filter((r) => matchesQuery(r, q))
      }

      const count = rows.length
      const page = rows.slice(offset, offset + limit)

      return res.json({
        consultations: page,
        count,
        limit,
        offset,
      })
    } catch (error) {
      return res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Failed to list consultations",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
}
