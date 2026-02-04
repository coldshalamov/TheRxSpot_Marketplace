import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../../../modules/business"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE) as any
  const complianceService = req.scope.resolve("complianceModuleService") as any

  const { id: businessId, locationId } = req.params as any

  const [locations] = await businessModuleService.listAndCountLocations(
    { id: locationId },
    { take: 1, withDeleted: true }
  )

  const existing = locations?.[0]
  if (!existing || existing.business_id !== businessId) {
    return res.status(404).json({ message: "Location not found" })
  }

  await businessModuleService.restoreLocations(locationId)
  const location = await businessModuleService.retrieveLocation(locationId).catch(() => null)

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
    entity_type: "business",
    entity_id: businessId,
    business_id: businessId,
    changes: { before: { location_deleted_at: existing.deleted_at ?? null }, after: { location_deleted_at: null } },
    metadata: { restored_location_id: locationId },
    risk_level: "medium",
  })

  return res.json({ location: location ?? existing })
}
