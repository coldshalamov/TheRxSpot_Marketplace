import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  
  const submission = await businessModuleService.retrieveConsultSubmission(id)
  
  res.json({ submission })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  const { action, notes } = req.body
  const reviewedBy = req.auth_context?.actor_id || "system"
  
  let submission
  if (action === "approve") {
    submission = await businessModuleService.approveConsultSubmission(id, reviewedBy)
  } else if (action === "reject") {
    submission = await businessModuleService.rejectConsultSubmission(id, reviewedBy, notes)
  }
  
  res.json({ submission })
}
