import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  
  const categories = await businessModuleService.listProductCategories(
    { is_active: true },
    { order: { sort_order: "ASC" } }
  )
  
  res.json({ categories })
}
