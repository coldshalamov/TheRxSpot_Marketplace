import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { locationId } = req.params
  
  const location = await businessModuleService.retrieveLocation(locationId)
  
  res.json({ location })
}

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { locationId } = req.params
  const body = (req.body ?? {}) as Record<string, any>
  
  const location = await businessModuleService.updateLocations({
    selector: { id: locationId },
    data: body,
  })
  
  res.json({ location: location[0] })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { locationId } = req.params
  
  await businessModuleService.deleteLocations(locationId)
  
  res.status(204).send()
}
