import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

/**
 * GET /store/consultations/approvals?product_id={id}
 *
 * Checks whether the authenticated customer has a valid approval for the given
 * product within the last 90 days.
 *
 * Response:
 * - has_valid_approval: boolean
 * - consultation_id: string | null
 * - expires_at: ISO string | null
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const authContext = (req as any).auth_context as
    | { actor_id?: string; actor_type?: string }
    | undefined

  const customerId = authContext?.actor_type === "customer" ? authContext.actor_id : undefined
  if (!customerId) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    })
  }

  const productId = (req.query?.product_id as string | undefined)?.trim()
  if (!productId) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "product_id is required",
    })
  }

  const business = (req as any).context?.business as { id: string } | undefined
  if (!business?.id) {
    return res.status(400).json({
      code: "BUSINESS_CONTEXT_REQUIRED",
      message: "Business context not found",
    })
  }

  const businessService = req.scope.resolve(BUSINESS_MODULE) as any

  try {
    const approvals = await businessService.listConsultApprovals(
      {
        customer_id: customerId,
        product_id: productId,
        business_id: business.id,
        status: "approved",
      },
      { take: 1, order: { approved_at: "DESC" } }
    )

    const approval = approvals?.[0]
    if (!approval?.approved_at) {
      return res.json({
        has_valid_approval: false,
        consultation_id: null,
        expires_at: null,
      })
    }

    const approvedAt = new Date(approval.approved_at)
    const now = new Date()

    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
    const isWithin90Days = now.getTime() - approvedAt.getTime() <= ninetyDaysMs

    const expiresAt = approval.expires_at
      ? new Date(approval.expires_at)
      : new Date(approvedAt.getTime() + ninetyDaysMs)

    const notExpired = expiresAt.getTime() >= now.getTime()

    const isValid = isWithin90Days && notExpired

    return res.json({
      has_valid_approval: isValid,
      consultation_id: isValid ? (approval.consultation_id ?? null) : null,
      expires_at: isValid ? expiresAt.toISOString() : null,
    })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to check consultation approval",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
