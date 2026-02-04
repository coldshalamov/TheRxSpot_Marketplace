import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  
  const business = await businessModuleService.retrieveBusiness(id, {
    relations: ["locations"],
  })
  
  res.json({ business })
}

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  
  const business = await businessModuleService.updateBusinesses({
    selector: { id },
    data: req.body,
  })
  
  res.json({ business: business[0] })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  
  await businessModuleService.deleteBusinesses(id)
  
  res.status(204).send()
}
