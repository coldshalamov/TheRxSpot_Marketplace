import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"
import { BUSINESS_MODULE } from "../../../../../modules/business"

/**
 * POST /admin/consultations/:id/generate-order
 *
 * Generates a draft order from an approved consultation's approved_medications.
 * This closes the consultation->order gap for async-form consultations
 * that don't have a pre-existing linked order.
 *
 * Body (optional):
 *   - shipping_address: { ... } override
 *   - items: [{ product_id, variant_id, quantity }] override (defaults to approved_medications)
 */
export const POST = [
  authenticate("user", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const { id: consultationId } = req.params
    const body = (req.body ?? {}) as Record<string, any>

    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const businessService = req.scope.resolve(BUSINESS_MODULE)
    const orderService = req.scope.resolve(Modules.ORDER)

    // 1. Fetch consultation
    let consultation: any
    try {
      consultation = await consultationService.getConsultationOrThrow(consultationId)
    } catch {
      return res.status(404).json({ message: `Consultation not found: ${consultationId}` })
    }

    // 2. Validate: must be completed + approved
    if (consultation.status !== "completed" || consultation.outcome !== "approved") {
      return res.status(400).json({
        message: `Cannot generate order: consultation must be completed with outcome 'approved'. Current: status=${consultation.status}, outcome=${consultation.outcome}`,
      })
    }

    // 3. Check if order already exists
    if (consultation.order_id) {
      return res.status(409).json({
        message: `Consultation already has a linked order: ${consultation.order_id}`,
        order_id: consultation.order_id,
      })
    }

    // 4. Get business for sales_channel
    const business = await businessService.retrieveBusiness(consultation.business_id)
    if (!business.sales_channel_id) {
      return res.status(400).json({
        message: "Business is not provisioned (no sales channel). Provision the business first.",
      })
    }

    // 5. Resolve patient -> customer
    let patient: any = null
    try {
      patient = await consultationService.getPatientOrThrow(consultation.patient_id)
    } catch {
      return res.status(400).json({
        message: "Patient not found for this consultation",
      })
    }

    if (!patient.customer_id) {
      return res.status(400).json({
        message: "Patient has no linked Medusa customer. Cannot create order.",
      })
    }

    // 6. Build line items from approved_medications or body override
    const approvedMedications = consultation.approved_medications || []
    const items = body.items || approvedMedications.map((med: any) => {
      if (typeof med === "string") {
        return { variant_id: med, quantity: 1 }
      }
      return {
        variant_id: med.variant_id || med.product_id,
        quantity: med.quantity || 1,
        unit_price: med.unit_price,
      }
    })

    if (!items.length) {
      return res.status(400).json({
        message: "No items to create order from. Consultation has no approved_medications and no items were provided.",
      })
    }

    try {
      // 7. Create draft order via Medusa order module
      const order = await orderService.createOrders({
        region_id: body.region_id || undefined,
        customer_id: patient.customer_id,
        sales_channel_id: business.sales_channel_id,
        email: patient.email || undefined,
        currency_code: body.currency_code || "usd",
        items: items.map((item: any) => ({
          title: item.title || "Approved Medication",
          variant_id: item.variant_id,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
        })),
        metadata: {
          consultation_id: consultationId,
          business_id: consultation.business_id,
          custom_status: "consult_complete",
          generated_from_consultation: true,
        },
      })

      // 8. Link consultation to the new order
      await consultationService.updateConsultation(consultationId, {
        order_id: order.id,
      })

      // 9. Create ConsultApprovals for the approved medications
      for (const med of approvedMedications) {
        const productId = typeof med === "string" ? med : med.product_id
        if (!productId) continue

        const now = new Date()
        const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000

        await businessService.createConsultApprovals({
          customer_id: patient.customer_id,
          product_id: productId,
          business_id: consultation.business_id,
          status: "approved",
          consultation_id: consultationId,
          approved_by: consultation.clinician_id ?? null,
          approved_at: now,
          expires_at: new Date(now.getTime() + ninetyDaysMs),
        })
      }

      res.status(201).json({
        order_id: order.id,
        consultation_id: consultationId,
        items_count: items.length,
        message: "Order generated from consultation",
      })
    } catch (error) {
      res.status(500).json({
        message: "Failed to generate order from consultation",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
