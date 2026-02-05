import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../modules/business"

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = (req as any).tenant_context
  if (!tenantContext) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  if (tenantContext.business_user.role !== "owner") {
    return res.status(403).json({ message: "Only owners can manage users" })
  }

  const { userId } = req.params
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  // Verify user belongs to same business
  const user = await businessModuleService.retrieveBusinessUser(userId)
  if (user.business_id !== tenantContext.business_id) {
    return res.status(403).json({ message: "User not in your tenant" })
  }

  const body = (req.body ?? {}) as Record<string, any>
  const { id: _ignored, ...data } = body

  const updated = await businessModuleService.updateBusinessUsers({
    id: userId,
    ...data,
  } as any)

  res.json({ user: updated })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = (req as any).tenant_context
  if (!tenantContext) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  if (tenantContext.business_user.role !== "owner") {
    return res.status(403).json({ message: "Only owners can manage users" })
  }

  const { userId } = req.params
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  const user = await businessModuleService.retrieveBusinessUser(userId)
  if (user.business_id !== tenantContext.business_id) {
    return res.status(403).json({ message: "User not in your tenant" })
  }

  await businessModuleService.deleteBusinessUsers(userId)

  res.status(204).send()
}
