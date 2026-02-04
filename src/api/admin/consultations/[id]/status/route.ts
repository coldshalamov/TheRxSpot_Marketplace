import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"
import { BUSINESS_MODULE } from "../../../../../modules/business"

type PlanStatus = "pending" | "scheduled" | "completed" | "approved" | "rejected"

const ALLOWED_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  pending: ["scheduled"],
  scheduled: ["completed"],
  completed: ["approved", "rejected"],
  approved: [],
  rejected: [],
}

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

function getPlanStatus(consultation: any): PlanStatus {
  if (consultation.status === "draft") return "pending"
  if (consultation.status === "scheduled") return "scheduled"
  if (consultation.status === "completed") {
    if (consultation.outcome === "approved") return "approved"
    if (consultation.outcome === "rejected") return "rejected"
    return "completed"
  }
  // For non-plan statuses, treat as pending to force explicit handling.
  return "pending"
}

/**
 * POST /admin/consultations/:id/status
 *
 * Body:
 * - status: "pending" | "scheduled" | "completed" | "approved" | "rejected"
 * - reason?: string (required when status="rejected")
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const body = (req.body ?? {}) as Record<string, any>

  const requestedStatus = typeof body.status === "string" ? body.status.trim() : ""
  const nextStatus = requestedStatus as PlanStatus

  if (!["pending", "scheduled", "completed", "approved", "rejected"].includes(nextStatus)) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message:
        "status must be one of: pending, scheduled, completed, approved, rejected",
    })
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  if (nextStatus === "rejected" && !reason) {
    return res.status(400).json({
      code: "REJECTION_REASON_REQUIRED",
      message: "reason is required when status is rejected",
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
  const businessService = req.scope.resolve(BUSINESS_MODULE) as any
  const complianceService = req.scope.resolve("complianceModuleService") as any

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
  } catch {
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

  const currentPlanStatus = getPlanStatus(consultation)
  const allowed = ALLOWED_TRANSITIONS[currentPlanStatus] || []
  if (!allowed.includes(nextStatus)) {
    return res.status(409).json({
      code: "INVALID_STATE_TRANSITION",
      message: `Invalid transition from ${currentPlanStatus} to ${nextStatus}. Allowed: ${
        allowed.length ? allowed.join(", ") : "none"
      }`,
    })
  }

  const before = {
    status: consultation.status,
    outcome: consultation.outcome ?? null,
    rejection_reason: consultation.rejection_reason ?? null,
  }

  try {
    if (nextStatus === "scheduled") {
      await consultationService.createConsultationStatusEvents({
        consultation_id: id,
        from_status: consultation.status,
        to_status: "scheduled",
        changed_by: actorId,
        reason: null,
        metadata: { plan_status: "scheduled" },
      })

      await consultationService.updateConsultations({
        id,
        status: "scheduled",
        scheduled_at: consultation.scheduled_at ?? new Date(),
        outcome: consultation.outcome ?? "pending",
      })
    } else if (nextStatus === "completed") {
      await consultationService.createConsultationStatusEvents({
        consultation_id: id,
        from_status: consultation.status,
        to_status: "completed",
        changed_by: actorId,
        reason: null,
        metadata: { plan_status: "completed" },
      })

      await consultationService.updateConsultations({
        id,
        status: "completed",
        ended_at: consultation.ended_at ?? new Date(),
        outcome: consultation.outcome ?? "pending",
      })
    } else if (nextStatus === "approved") {
      const approvals = await businessService.listConsultApprovals(
        { consultation_id: id, business_id: consultation.business_id },
        { take: 1, order: { approved_at: "DESC" } }
      )

      const approval = approvals?.[0]
      if (!approval) {
        return res.status(400).json({
          code: "CONSULT_APPROVAL_RECORD_MISSING",
          message:
            "No consult approval record found for this consultation. Create a pending approval before approving.",
        })
      }

      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
      const now = new Date()

      await businessService.updateConsultApprovals({
        id: approval.id,
        status: "approved",
        approved_by: actorId,
        approved_at: now,
        expires_at: new Date(now.getTime() + ninetyDaysMs),
      })

      await consultationService.createConsultationStatusEvents({
        consultation_id: id,
        from_status: consultation.status,
        to_status: consultation.status,
        changed_by: actorId,
        reason: null,
        metadata: { plan_status: "approved" },
      })

      await consultationService.updateConsultations({
        id,
        status: "completed",
        outcome: "approved",
        rejection_reason: null,
      })
    } else if (nextStatus === "rejected") {
      const approvals = await businessService.listConsultApprovals(
        { consultation_id: id, business_id: consultation.business_id },
        { take: 1, order: { approved_at: "DESC" } }
      )

      const approval = approvals?.[0]
      if (approval) {
        await businessService.updateConsultApprovals({
          id: approval.id,
          status: "rejected",
          approved_by: actorId,
          approved_at: null,
          expires_at: null,
        })
      }

      await consultationService.createConsultationStatusEvents({
        consultation_id: id,
        from_status: consultation.status,
        to_status: consultation.status,
        changed_by: actorId,
        reason,
        metadata: { plan_status: "rejected" },
      })

      await consultationService.updateConsultations({
        id,
        status: "completed",
        outcome: "rejected",
        rejection_reason: reason,
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
        after: {
          status: consultation.status,
          outcome: consultation.outcome ?? null,
          rejection_reason: consultation.rejection_reason ?? null,
        },
      },
      metadata: { event: "consultation_status_change", requested_status: nextStatus },
      risk_level: "medium",
    })

    return res.json({
      consultation: {
        id: consultation.id,
        business_id: consultation.business_id,
        status: consultation.status,
        outcome: consultation.outcome ?? null,
        rejection_reason: consultation.rejection_reason ?? null,
        scheduled_at: consultation.scheduled_at ?? null,
        ended_at: consultation.ended_at ?? null,
        updated_at: consultation.updated_at,
      },
    })
  } catch (error) {
    return res.status(400).json({
      code: "STATUS_UPDATE_FAILED",
      message: "Failed to update consultation status",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
