import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONSULTATION_MODULE } from "../../../../../../modules/consultation"
import { getAuthActor, getOptionalTenantBusinessId } from "../../_helpers"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const { id } = req.params
    const body = (req.body ?? {}) as Record<string, any>

    const notes = typeof body.notes === "string" ? body.notes : undefined
    const adminNotes = typeof body.admin_notes === "string" ? body.admin_notes : undefined

    if (notes === undefined && adminNotes === undefined) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "notes and/or admin_notes must be provided",
      })
    }

    if (notes != null && notes.length > 50000) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "notes is too large",
      })
    }
    if (adminNotes != null && adminNotes.length > 50000) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "admin_notes is too large",
      })
    }

    const tenantBusinessId = getOptionalTenantBusinessId(req)
    const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
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

    const before = { notes: consultation.notes ?? null, admin_notes: consultation.admin_notes ?? null }

    try {
      const update: any = { id }
      if (notes !== undefined) update.notes = notes
      if (adminNotes !== undefined) update.admin_notes = adminNotes

      await consultationService.updateConsultations(update)

      const updated = await consultationService.getConsultationOrThrow(id)

      const actor = getAuthActor(req)
      await complianceService?.logAuditEvent?.({
        actor_type: actor.actor_type,
        actor_id: actor.actor_id,
        actor_email: actor.actor_email,
        ip_address: actor.ip_address,
        user_agent: actor.user_agent,
        action: "update",
        entity_type: "consultation",
        entity_id: id,
        business_id: updated.business_id ?? null,
        consultation_id: id,
        changes: {
          before,
          after: { notes: updated.notes ?? null, admin_notes: updated.admin_notes ?? null },
        },
        metadata: { event: "consultation_notes_update" },
        risk_level: "medium",
      })

      return res.json({ consultation: updated })
    } catch (error) {
      return res.status(400).json({
        code: "NOTES_UPDATE_FAILED",
        message: "Failed to update consultation notes",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
}
