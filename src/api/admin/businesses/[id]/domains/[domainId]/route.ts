import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../../modules/business"

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const { domainId } = req.params
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  const body = (req.body ?? {}) as Record<string, any>
  const { id: _ignored, ...data } = body

  const updated = await businessModuleService.updateBusinessDomains({
    id: domainId,
    ...data,
  } as any)

  res.json({ domain: updated })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { domainId } = req.params
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  await businessModuleService.softDeleteBusinessDomains(domainId)

  res.status(204).send()
}
