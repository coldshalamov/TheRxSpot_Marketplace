import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../../modules/business"

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const { domainId } = req.params
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  const updated = await businessModuleService.updateBusinessDomains(
    domainId,
    req.body
  )

  res.json({ domain: updated })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { domainId } = req.params
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  await (businessModuleService as any).softDeleteBusinessDomains(domainId)

  res.status(204).send()
}
