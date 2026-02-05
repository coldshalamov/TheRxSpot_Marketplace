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
  
  const body = (req.body ?? {}) as Record<string, any>
  const { id: _ignored, ...data } = body

  const business = await businessModuleService.updateBusinesses({
    id,
    ...data,
  } as any)
  
  res.json({ business })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  
  await businessModuleService.softDeleteBusinesses(id)
  
  res.status(204).send()
}
