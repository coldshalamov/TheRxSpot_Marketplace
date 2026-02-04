import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../modules/business"

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["approved"],
  approved: ["active", "suspended"],
  active: ["suspended"],
  suspended: ["active"],
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const { status } = req.body as { status: string }

  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const business = await businessModuleService.retrieveBusiness(id)

  const allowed = VALID_TRANSITIONS[business.status] || []
  if (!allowed.includes(status)) {
    return res.status(400).json({
      message: `Cannot transition from "${business.status}" to "${status}". Allowed: ${allowed.join(", ") || "none"}`,
    })
  }

  const [updated] = await businessModuleService.updateBusinesses({
    selector: { id },
    data: { status },
  })

  res.json({ business: updated })
}
