import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  
  const locations = await businessModuleService.listLocations(
    { business_id: id },
    { order: { name: "ASC" } }
  )
  
  res.json({ locations })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  
  const location = await businessModuleService.createLocations({
    ...req.body,
    business_id: id,
  })
  
  res.status(201).json({ location })
}
