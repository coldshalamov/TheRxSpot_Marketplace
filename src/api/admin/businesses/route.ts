import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  const statusFilter = req.query.status as string | undefined
  const filters: Record<string, any> = {}
  if (statusFilter) {
    filters.status = statusFilter
  }

  const businesses = await businessModuleService.listAndCountBusinesses(filters)

  res.json({ businesses: businesses[0], count: businesses[1] })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const body = (req.body ?? {}) as Record<string, any>

  const business = await businessModuleService.createBusiness({
    ...body,
    status: "pending",
  })

  res.status(201).json({ business })
}
