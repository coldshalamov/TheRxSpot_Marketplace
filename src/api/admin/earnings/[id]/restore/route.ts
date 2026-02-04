import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../../../modules/financials"
import {
  ensureTenantContext,
  createNotFoundResponse,
  logSecurityEvent,
  TenantContext,
} from "../../../../middlewares/tenant-isolation"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantContext = ensureTenantContext(req, res) as TenantContext | null
  if (!tenantContext) {
    return
  }

  const financialsService = req.scope.resolve(FINANCIALS_MODULE) as any
  const complianceService = req.scope.resolve("complianceModuleService") as any

  const { id } = req.params

  const [existingList] = await financialsService.listAndCountEarningEntries(
    { id },
    { take: 1, withDeleted: true }
  )
  const existing = existingList?.[0]

  if (!existing || existing.business_id !== tenantContext.business_id) {
    if (existing) {
      await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
        resource: "earning",
        resource_id: id,
        attempted_by_business: tenantContext.business_id,
        target_business_id: existing.business_id,
      })
    }
    const notFound = createNotFoundResponse("Earning")
    return res.status(notFound.status).json(notFound.body)
  }

  await financialsService.restoreEarningEntries(id)
  const [restoredList] = await financialsService.listAndCountEarningEntries({ id }, { take: 1 })
  const restored = restoredList?.[0]

  const authContext = (req as any).auth_context as any
  const actorId = authContext?.actor_id || "unknown"
  const actorType =
    authContext?.actor_type === "user" ? "business_user" : authContext?.actor_type || "business_user"
  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req as any).ip ||
    req.socket?.remoteAddress ||
    null
  const userAgent = (req.headers["user-agent"] as string) || null

  await complianceService?.logAuditEvent?.({
    actor_type: actorType,
    actor_id: actorId,
    actor_email: authContext?.actor_email ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
    action: "update",
    entity_type: "earning",
    entity_id: id,
    business_id: tenantContext.business_id,
    changes: { before: { deleted_at: existing.deleted_at ?? null }, after: { deleted_at: null } },
    metadata: { restored: true },
    risk_level: "medium",
  })

  return res.json({ earning: restored ?? existing })
}
