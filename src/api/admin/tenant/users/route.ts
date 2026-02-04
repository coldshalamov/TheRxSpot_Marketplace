import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = (req as any).tenant_context
  if (!tenantContext) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  // Only owners can manage users
  if (tenantContext.business_user.role !== "owner") {
    return res.status(403).json({ message: "Only owners can manage users" })
  }

  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const users = await businessModuleService.listBusinessUsers({
    business_id: tenantContext.business_id,
  })

  res.json({ users })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = (req as any).tenant_context
  if (!tenantContext) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  if (tenantContext.business_user.role !== "owner") {
    return res.status(403).json({ message: "Only owners can manage users" })
  }

  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { email, role } = req.body as { email: string; role?: string }

  const user = await businessModuleService.createBusinessUsers({
    business_id: tenantContext.business_id,
    email,
    role: role || "staff",
  })

  res.status(201).json({ user })
}
