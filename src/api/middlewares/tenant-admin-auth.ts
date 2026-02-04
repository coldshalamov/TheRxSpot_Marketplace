import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../modules/business"

export const tenantAdminAuthMiddleware = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  // Resolve tenant user from the authenticated session
  // The auth identity is available from Medusa's built-in auth middleware
  const authIdentityId = (req as any).auth_context?.auth_identity_id

  if (!authIdentityId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  // Look up the BusinessUser by auth_identity_id
  const businessUsers = await businessModuleService.listBusinessUsers(
    { auth_identity_id: authIdentityId, is_active: true },
    { take: 1 }
  )

  if (!businessUsers.length) {
    return res.status(403).json({ message: "No tenant access" })
  }

  const businessUser = businessUsers[0]

  // Attach tenant context
  ;(req as any).tenant_context = {
    business_id: businessUser.business_id,
    business_user: businessUser,
  }

  next()
}
