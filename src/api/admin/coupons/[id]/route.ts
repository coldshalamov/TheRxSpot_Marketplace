import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

/**
 * GET /admin/coupons/:id
 * Retrieve a single coupon by ID.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params

  const coupon = await businessService.retrieveCoupon(id)
  res.json({ coupon })
}

/**
 * PUT /admin/coupons/:id
 * Update a coupon.
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  const body = (req.body ?? {}) as Record<string, any>

  const { id: _ignored, ...data } = body

  // Normalize code if provided
  if (data.code) {
    data.code = data.code.toUpperCase()
  }

  const coupon = await businessService.updateCoupons({ id, ...data } as any)
  res.json({ coupon })
}

/**
 * DELETE /admin/coupons/:id
 * Soft-delete a coupon.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params

  await businessService.softDeleteCoupons(id)
  res.status(204).send()
}
