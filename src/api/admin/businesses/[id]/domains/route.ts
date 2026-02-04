import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  const domains = await businessModuleService.listBusinessDomainsByBusiness(id)

  res.json({ domains })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  const { domain, is_primary } = req.body as {
    domain: string
    is_primary?: boolean
  }

  const businessDomain = await businessModuleService.createBusinessDomains({
    business_id: id,
    domain,
    is_primary: is_primary || false,
  })

  res.status(201).json({ domain: businessDomain })
}
