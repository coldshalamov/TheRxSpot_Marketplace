import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  
  const submission = await businessModuleService.retrieveConsultSubmissionDecrypted(id)
  
  res.json({ submission })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  const { action, notes } = (req.body ?? {}) as { action?: string; notes?: string }
  const reviewedBy = ((req as any).auth_context?.actor_id as string | undefined) || "system"
  
  let submission
  if (action === "approve") {
    submission = await businessModuleService.approveConsultSubmission(id, reviewedBy)
  } else if (action === "reject") {
    submission = await businessModuleService.rejectConsultSubmission(id, reviewedBy, notes)
  }
  
  res.json({ submission })
}
