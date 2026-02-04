import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  
  const submissions = await businessModuleService.listAndCountConsultSubmissions(
    {},
    { order: { created_at: "DESC" } }
  )
  
  res.json({ submissions: submissions[0], count: submissions[1] })
}
