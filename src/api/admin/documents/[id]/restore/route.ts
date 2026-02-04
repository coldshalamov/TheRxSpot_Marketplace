import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../../modules/compliance/service"
import {
  ensureTenantContext,
  createNotFoundResponse,
  logSecurityEvent,
  TenantContext,
} from "../../../../middlewares/tenant-isolation"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const complianceService: ComplianceModuleService = req.scope.resolve("complianceModuleService")
  const tenantContext = ensureTenantContext(req, res) as TenantContext | null
  if (!tenantContext) {
    return
  }

  const { id } = req.params

  const [docs] = await (complianceService as any).listAndCountDocuments(
    { id },
    { take: 1, withDeleted: true }
  )

  const existing = docs?.[0]
  if (!existing || existing.business_id !== tenantContext.business_id) {
    if (existing) {
      await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
        resource: "document",
        resource_id: id,
        attempted_by_business: tenantContext.business_id,
        target_business_id: existing.business_id,
      })
    }
    const notFound = createNotFoundResponse("Document")
    return res.status(notFound.status).json(notFound.body)
  }

  await (complianceService as any).restoreDocuments(id)
  const [docsAfter] = await (complianceService as any).listAndCountDocuments({ id }, { take: 1 })
  const updated = docsAfter?.[0]

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

  await (complianceService as any)?.logAuditEvent?.({
    actor_type: actorType,
    actor_id: actorId,
    actor_email: authContext?.actor_email ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
    action: "update",
    entity_type: "document",
    entity_id: id,
    business_id: tenantContext.business_id,
    changes: { before: { deleted_at: existing.deleted_at ?? null }, after: { deleted_at: null } },
    metadata: { restored: true },
    risk_level: "medium",
  })

  return res.json({ document: updated ?? existing })
}
