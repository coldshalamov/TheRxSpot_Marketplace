import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../modules/business"

/**
 * GET /admin/coupons
 * List coupons, optionally filtered by business_id.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const businessId = req.query.business_id as string | undefined

  const filters: Record<string, any> = {}
  if (businessId) filters.business_id = businessId

  const coupons = await businessService.listCoupons(filters, {
    order: { created_at: "DESC" },
  })

  res.json({ coupons })
}

/**
 * POST /admin/coupons
 * Create a new coupon.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const body = (req.body ?? {}) as Record<string, any>

  if (!body.business_id) {
    return res.status(400).json({ message: "business_id is required" })
  }
  if (!body.code) {
    return res.status(400).json({ message: "code is required" })
  }

  // Normalize coupon code to uppercase
  const data = {
    ...body,
    code: body.code.toUpperCase(),
  }

  // Check for duplicate code within the business
  const existing = await businessService.getCouponByCode(data.business_id, data.code)
  if (existing) {
    return res.status(409).json({ message: `Coupon code '${data.code}' already exists for this business` })
  }

  const coupon = await businessService.createCoupons(data)
  res.status(201).json({ coupon })
}
