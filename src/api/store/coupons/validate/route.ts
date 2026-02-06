import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

/**
 * POST /store/coupons/validate
 * Validate a coupon code for a given business and order amount.
 * Body: { business_id, code, order_amount? }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const body = (req.body ?? {}) as Record<string, any>

  if (!body.business_id || !body.code) {
    return res.status(400).json({ message: "business_id and code are required" })
  }

  const result = await businessService.validateCoupon(
    body.business_id,
    body.code,
    body.order_amount ? Number(body.order_amount) : undefined
  )

  if (!result.valid) {
    return res.status(422).json({
      valid: false,
      reason: result.reason,
    })
  }

  const coupon = result.coupon
  res.json({
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      max_discount_amount: coupon.max_discount_amount,
    },
  })
}
