import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"
import { BUSINESS_MODULE } from "../../../../../modules/business"
import {
  derivePlanType,
  extractStateFromSubmission,
  getOptionalTenantBusinessId,
  getPlanStatus,
  modeToPlanMode,
} from "../_helpers"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const { id } = req.params

    const tenantBusinessId = getOptionalTenantBusinessId(req)
    const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
    const businessService = req.scope.resolve(BUSINESS_MODULE) as any
    const productService = req.scope.resolve(Modules.PRODUCT) as any

    try {
      const consultation = await consultationService.getConsultationOrThrow(id)

      if (tenantBusinessId && consultation.business_id !== tenantBusinessId) {
        return res.status(404).json({ code: "NOT_FOUND", message: "Consultation not found" })
      }

      const patient = await consultationService.getPatientOrThrow(consultation.patient_id)
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
          // Depending on Medusa version, listProducts may return `Product[]` or `[Product[], count]`.
          if (Array.isArray(listed?.[0])) {
            product = listed?.[0]?.[0] ?? null
          } else if (Array.isArray(listed)) {
            product = listed?.[0] ?? null
          } else {
            product = null
          }
        } catch {
          product = null
        }
      }

      const [statusEvents] = await consultationService.listStatusEventsByConsultation(id).catch(() => [[]])

      return res.json({
        consultation: {
          ...consultation,
          plan_status: getPlanStatus(consultation),
          mode: modeToPlanMode(consultation.mode),
          type: derivePlanType(consultation),
          state,
          patient,
          clinician,
          business,
          submission,
          product,
          status_history: statusEvents || [],
        },
      })
    } catch (error) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Consultation not found",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
}
