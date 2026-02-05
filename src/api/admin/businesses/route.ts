import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../modules/business"
import { provisionBusinessWorkflow } from "../../../workflows/provision-business"

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

  // 1. Create the business in pending state
  const business = await businessModuleService.createBusinesses({
    ...body,
    status: "pending",
  } as any)

  // 2. Provision the business (Sales Channel, API Key, Stock Location)
  const { result } = await provisionBusinessWorkflow(req.scope).run({
    input: {
      business_id: business.id,
      storefront_base_url: body.storefront_url, // Allow passing this in
    },
  })

  res.status(201).json({ business: result })
}

