import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"

function getOptionalTenantBusinessId(req: MedusaRequest): string | undefined {
  const authContext = (req as any).auth_context as
    | {
        business_id?: string
        metadata?: Record<string, any>
        app_metadata?: Record<string, any>
      }
    | undefined

  return (
    authContext?.business_id ||
    authContext?.metadata?.business_id ||
    authContext?.app_metadata?.business_id
  )
}

function getRequestIp(req: MedusaRequest): string | null {
  return (
    ((req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      (req as any).request_context?.ip_address ??
      (req as any).ip ??
      null)
  )
}

/**
 * POST /admin/consultations/:id/assign
 *
 * Body:
 * - clinician_id: string
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const body = (req.body ?? {}) as Record<string, any>

  const clinicianId = typeof body.clinician_id === "string" ? body.clinician_id.trim() : ""
  if (!clinicianId) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "clinician_id is required",
    })
  }

  const authContext = (req as any).auth_context as
    | { actor_id?: string; actor_type?: string; actor_email?: string }
    | undefined

  const actorId = authContext?.actor_id || "unknown"
  const actorType = ((authContext?.actor_type || "business_user") === "user"
    ? "business_user"
    : authContext?.actor_type || "business_user") as any

  const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
  const complianceService = req.scope.resolve("complianceModuleService") as any
  const eventBus = (req.scope as any).resolve?.("event_bus") ?? null

  let consultation: any
  try {
    const [consultations] = await consultationService.listAndCountConsultations(
      { id },
      { take: 1 }
    )
    consultation = consultations?.[0]
    if (!consultation) {
      throw new Error("not found")
    }
  } catch (error) {
    return res.status(404).json({
      code: "NOT_FOUND",
      message: "Consultation not found",
    })
  }

  const tenantBusinessId = getOptionalTenantBusinessId(req)
  if (tenantBusinessId && consultation.business_id !== tenantBusinessId) {
    return res.status(404).json({
      code: "NOT_FOUND",
      message: "Consultation not found",
    })
  }

  const before = { clinician_id: consultation.clinician_id ?? null, status: consultation.status }

  try {
    const [clinicians] = await consultationService.listAndCountClinicians(
      { id: clinicianId },
      { take: 1 }
    )
    const clinician = clinicians?.[0]
    if (!clinician) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: `Clinician not found: ${clinicianId}`,
      })
    }

    if (clinician.business_id && clinician.business_id !== consultation.business_id) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "Clinician does not belong to this business",
      })
    }

    await consultationService.updateConsultations({ id, clinician_id: clinicianId })

    // Minimal viable behavior: assigning a clinician moves a pending consult into "scheduled".
    if (consultation.status === "draft") {
      await consultationService.createConsultationStatusEvents({
        consultation_id: id,
        from_status: "draft",
        to_status: "scheduled",
        changed_by: actorId,
        reason: "Clinician assigned",
        metadata: { event: "consultation_assigned" },
      })

      await consultationService.updateConsultations({
        id,
        status: "scheduled",
        scheduled_at: consultation.scheduled_at ?? new Date(),
      })
    }

    const [afterConsultations] = await consultationService.listAndCountConsultations(
      { id },
      { take: 1 }
    )
    consultation = afterConsultations?.[0]

    await complianceService?.logAuditEvent?.({
      actor_type: actorType,
      actor_id: actorId,
      actor_email: authContext?.actor_email ?? null,
      ip_address: getRequestIp(req),
      user_agent: (req.headers["user-agent"] as string | undefined) ?? null,
      action: "update",
      entity_type: "consultation",
      entity_id: id,
      business_id: consultation.business_id ?? null,
      consultation_id: id,
      changes: {
        before,
        after: { clinician_id: consultation.clinician_id ?? null, status: consultation.status },
      },
      metadata: { event: "consultation_assigned", clinician_id: clinicianId },
      risk_level: "medium",
    })

    try {
      await eventBus?.emit?.("consultation.assigned", {
        consultation_id: id,
        business_id: consultation.business_id,
        clinician_id: clinicianId,
      })
    } catch {
      // Notification/event emission is best-effort in baseline implementation.
    }

    return res.json({
      consultation: {
        id: consultation.id,
        business_id: consultation.business_id,
        status: consultation.status,
        clinician_id: consultation.clinician_id,
        scheduled_at: consultation.scheduled_at,
        updated_at: consultation.updated_at,
      },
    })
  } catch (error) {
    return res.status(400).json({
      code: "ASSIGN_FAILED",
      message: "Failed to assign clinician to consultation",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
