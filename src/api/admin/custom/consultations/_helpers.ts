import { MedusaRequest } from "@medusajs/framework/http"

export type PlanStatus = "pending" | "scheduled" | "completed" | "approved" | "rejected"
export type PlanMode = "video" | "audio" | "form"
export type PlanType = "initial" | "follow-up"

export function getOptionalTenantBusinessId(req: MedusaRequest): string | undefined {
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

export function getRequestIp(req: MedusaRequest): string | null {
  return (
    ((req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      (req as any).request_context?.ip_address ??
      (req as any).ip ??
      null)
  )
}

export function getAuthActor(req: MedusaRequest): {
  actor_id: string
  actor_type: string
  actor_email: string | null
  user_agent: string | null
  ip_address: string | null
} {
  const authContext = (req as any).auth_context as
    | { actor_id?: string; actor_type?: string; actor_email?: string }
    | undefined

  const actorId = authContext?.actor_id || "unknown"
  const actorType =
    ((authContext?.actor_type || "business_user") === "user"
      ? "business_user"
      : authContext?.actor_type || "business_user") as any

  return {
    actor_id: actorId,
    actor_type: actorType,
    actor_email: authContext?.actor_email ?? null,
    user_agent: (req.headers["user-agent"] as string | undefined) ?? null,
    ip_address: getRequestIp(req),
  }
}

export function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date
}

export function asInt(value: any, fallback: number): number {
  if (value == null) return fallback
  const num = typeof value === "string" ? parseInt(value, 10) : Number(value)
  return Number.isFinite(num) ? Math.trunc(num) : fallback
}

export function parseCommaList(value: any): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => (typeof v === "string" ? v.split(",") : []))
      .map((v) => v.trim())
      .filter(Boolean)
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}

export function normalizeDigits(value: string): string {
  return value.replace(/[^\d]/g, "")
}

export function normalizeText(value: string): string {
  return value.toLowerCase().trim()
}

export function getPlanStatus(consultation: any): PlanStatus {
  if (consultation.status === "draft") return "pending"
  if (consultation.status === "scheduled") return "scheduled"
  if (consultation.status === "completed") {
    if (consultation.outcome === "approved") return "approved"
    if (consultation.outcome === "rejected") return "rejected"
    return "completed"
  }
  // Non-plan statuses are treated as pending so the UI forces explicit handling.
  return "pending"
}

export function derivePlanType(consultation: any): PlanType {
  return consultation.originating_submission_id ? "initial" : "follow-up"
}

export function modeToPlanMode(mode: string | null | undefined): PlanMode {
  if (mode === "video") return "video"
  if (mode === "phone") return "audio"
  // Treat async_form + chat as "form" per PLAN (video/audio/form).
  return "form"
}

export function planModeToInternalModes(mode: PlanMode): string[] {
  if (mode === "video") return ["video"]
  if (mode === "audio") return ["phone"]
  return ["async_form", "chat"]
}

export function extractStateFromSubmission(submission: any): string | null {
  const answers = submission?.eligibility_answers
  if (!answers || typeof answers !== "object") return null
  const direct =
    (typeof answers.state === "string" && answers.state.trim()) ||
    (typeof answers.shipping_state === "string" && answers.shipping_state.trim()) ||
    (typeof answers.patient_state === "string" && answers.patient_state.trim())
  if (!direct) return null
  return direct.trim().toUpperCase()
}

