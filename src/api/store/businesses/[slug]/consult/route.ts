import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { slug } = req.params
  
  const business = await businessModuleService.getBusinessBySlug(slug)
  
  if (!business) {
    return res.status(404).json({ message: "Business not found" })
  }
  
  const submission = await businessModuleService.createConsultSubmissions({
    ...req.body,
    business_id: business.id,
  })
  
  res.status(201).json({ submission })
}
