import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../../../../modules/business"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"

function asCents(value: any): number {
  if (value == null) return 0
  if (typeof value === "number") return Math.trunc(value)
  if (typeof value === "string") return parseInt(value, 10) || 0
  if (typeof value === "object" && typeof value.value === "string") return parseInt(value.value, 10) || 0
  return Number(value) || 0
}

/**
 * POST /store/carts/:id/consultation-fee
 *
 * Adds a custom-priced cart line item representing the consultation fee for a
 * specific approved consultation.
 *
 * Body:
 * - consultation_id: string
 *
 * Notes:
 * - Requires a customer session (JWT bearer).
 * - Validates that a matching ConsultApproval exists and is approved.
 * - De-dupes by consultation_id so the fee isn't added twice.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const authContext = (req as any).auth_context as
    | { actor_id?: string; actor_type?: string }
    | undefined

  const customerId = authContext?.actor_type === "customer" ? authContext.actor_id : undefined
  if (!customerId) {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Not authenticated" })
  }

  const cartId = req.params.id
  const body = (req.body ?? {}) as Record<string, any>
  const consultationId = typeof body.consultation_id === "string" ? body.consultation_id.trim() : ""

  if (!consultationId) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "consultation_id is required",
    })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "customer_id", "email", "metadata", "items.id", "items.metadata"],
    filters: { id: cartId },
  })

  const cart = carts?.[0]
  if (!cart) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Cart not found" })
  }

  // Prevent leaking cart existence across customers.
  if (cart.customer_id && cart.customer_id !== customerId) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Cart not found" })
  }

  const existing = (cart.items || []).find((it: any) => {
    const meta = it?.metadata
    return meta?.type === "consultation_fee" && meta?.consultation_id === consultationId
  })
  if (existing) {
    return res.json({ added: false, line_item_id: existing.id })
  }

  const businessService = req.scope.resolve(BUSINESS_MODULE) as any
  const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
  const cartService = req.scope.resolve(Modules.CART) as any

  const consultation = await consultationService.getConsultationOrThrow(consultationId).catch(() => null)
  if (!consultation) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Consultation not found" })
  }

  const businessContext = (req as any).context?.business as { id?: string; settings?: any } | undefined
  const businessId =
    businessContext?.id ||
    (cart?.metadata?.business_id as string | undefined) ||
    (consultation.business_id as string | undefined)

  if (!businessId) {
    return res.status(400).json({
      code: "BUSINESS_CONTEXT_REQUIRED",
      message: "Business context not found",
    })
  }

  if (consultation.business_id !== businessId) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Consultation not found" })
  }

  const approvals = await businessService.listConsultApprovals(
    {
      customer_id: customerId,
      consultation_id: consultationId,
      business_id: businessId,
      status: "approved",
    },
    { take: 1, order: { approved_at: "DESC" } }
  )

  const approval = approvals?.[0]
  if (!approval) {
    return res.status(409).json({
      code: "CONSULT_APPROVAL_REQUIRED",
      message: "Consultation is not approved",
    })
  }

  const productId = approval.product_id ?? null
  const expiresAt = approval.expires_at ?? null

  let feeCents = 0
  if (consultation.originating_submission_id) {
    const submission = await businessService
      .retrieveConsultSubmission(consultation.originating_submission_id)
      .catch(() => null)
    feeCents = asCents(submission?.consult_fee)
  }

  if (!feeCents) {
    feeCents = asCents(businessContext?.settings?.consult_fee_cents)
  }

  const title = productId ? `Consultation fee` : "Consultation fee"

  await cartService.addLineItems(cartId, [
    {
      cart_id: cartId,
      title,
      quantity: 1,
      unit_price: feeCents,
      is_custom_price: true,
      requires_shipping: false,
      is_discountable: false,
      metadata: {
        type: "consultation_fee",
        consultation_id: consultationId,
        product_id: productId,
        expires_at: expiresAt,
      },
    } as any,
  ])

  return res.json({ added: true, fee_cents: feeCents })
}
