import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = (req as any).tenant_context

  if (!tenantContext) {
    return res.status(401).json({ message: "Not authenticated as tenant user" })
  }

  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const business = await businessModuleService.retrieveBusiness(
    tenantContext.business_id
  )

  res.json({
    business,
    user: tenantContext.business_user,
  })
}
