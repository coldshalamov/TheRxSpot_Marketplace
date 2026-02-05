import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { CONSULTATION_MODULE } from "../modules/consultation"
import { BUSINESS_MODULE } from "../modules/business"
import { FINANCIALS_MODULE } from "../modules/financials"
import { orderStatusTransitionWorkflow } from "../workflows/order-lifecycle"
import { runWorkflowOrThrow } from "../utils/workflow"

/**
 * Handler for consultation.completed event
 * - Updates linked order status based on outcome
 * - Creates consultation fee earnings
 * - Creates ConsultApproval records for approved medications
 */
export default async function consultationCompletedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const { id: consultationId } = event.data

  const consultationService = container.resolve(CONSULTATION_MODULE)
  const businessService = container.resolve(BUSINESS_MODULE)
  const financialsService = container.resolve(FINANCIALS_MODULE)

  try {
    // Fetch consultation
    const consultation = await consultationService.getConsultationOrThrow(consultationId)

    const { order_id: orderId, outcome, business_id: businessId } = consultation

    if (!orderId) {
      console.log(
        `[consultation-completed] Consultation ${consultationId} has no linked order`
      )
      return
    }

    console.log(
      `[consultation-completed] Processing consultation ${consultationId} for order ${orderId}, outcome: ${outcome}`
    )

    if (outcome === "approved") {
      // Approve order - update status to consult_complete
      const orderService = container.resolve(Modules.ORDER)
      const order = await orderService.retrieveOrder(orderId)

      if (!order) {
        console.error(`[consultation-completed] Order not found: ${orderId}`)
        return
      }

      const currentStatus =
        (order.metadata?.custom_status as string) || "consult_pending"

      // Execute workflow to transition status
      await runWorkflowOrThrow(orderStatusTransitionWorkflow(container), {
        input: {
          orderId,
          fromStatus: currentStatus,
          toStatus: "consult_complete",
          changedBy: consultation.clinician_id ?? "system",
          reason: "Consultation approved by clinician",
        },
      })

      // Create consultation fee earnings
      // Default consultation fee - could be configurable per business
      const consultationFee = 50.0
      await financialsService.calculateConsultationEarnings({
        id: consultationId,
        business_id: businessId,
        clinician_id: consultation.clinician_id ?? undefined,
        fee: consultationFee,
        currency_code: "usd",
      })

      // Create ConsultApproval records for approved medications
      const approvedMedications = consultation.approved_medications || []
      for (const medication of approvedMedications) {
        // medication could be a product_id or an object with details
        const productId =
          typeof medication === "string" ? medication : medication.product_id

        // customer_id must refer to the Medusa customer id (not patient id).
        const patient = await consultationService.getPatientOrThrow(consultation.patient_id).catch(() => null)
        const customerId = patient?.customer_id ?? null
        if (!customerId) {
          console.warn(
            `[consultation-completed] Consultation ${consultationId} patient ${consultation.patient_id} has no customer_id; skipping consult approval creation`
          )
          continue
        }

        const now = new Date()
        const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000

        // Prefer updating an existing pending approval created during consult intake.
        const pending = await businessService.listConsultApprovals(
          { business_id: businessId, customer_id: customerId, product_id: productId, status: "pending" },
          { take: 1, order: { created_at: "DESC" } }
        )

        if (pending?.[0]) {
          await businessService.updateConsultApprovals({
            id: pending[0].id,
            status: "approved",
            consultation_id: consultationId,
            approved_by: consultation.clinician_id ?? null,
            approved_at: now,
            expires_at: new Date(now.getTime() + ninetyDaysMs),
          })
          continue
        }

        // If none exists, create an approved record (idempotent-ish at app level).
        await businessService.createConsultApprovals({
          customer_id: customerId,
          product_id: productId,
          business_id: businessId,
          status: "approved",
          consultation_id: consultationId,
          approved_by: consultation.clinician_id ?? null,
          approved_at: now,
          expires_at: new Date(now.getTime() + ninetyDaysMs),
        })
      }

      console.log(
        `[consultation-completed] Order ${orderId} approved, created earnings and ${approvedMedications.length} consult approvals`
      )
    } else if (outcome === "rejected") {
      // Reject order - update status to consult_rejected
      const orderService = container.resolve(Modules.ORDER)
      const order = await orderService.retrieveOrder(orderId)

      if (!order) {
        console.error(`[consultation-completed] Order not found: ${orderId}`)
        return
      }

      const currentStatus =
        (order.metadata?.custom_status as string) || "consult_pending"

      // Execute workflow to transition status
      await runWorkflowOrThrow(orderStatusTransitionWorkflow(container), {
        input: {
          orderId,
          fromStatus: currentStatus,
          toStatus: "consult_rejected",
          changedBy: consultation.clinician_id ?? "system",
          reason: `Consultation rejected: ${consultation.rejection_reason || "No reason provided"}`,
        },
      })

      // Note: Actual refund would be handled by a separate refund workflow
      // triggered by the order status change to consult_rejected

      console.log(
        `[consultation-completed] Order ${orderId} rejected due to consultation outcome`
      )
    } else {
      console.log(
        `[consultation-completed] Consultation ${consultationId} has outcome: ${outcome}, no order action taken`
      )
    }
  } catch (error) {
    console.error(
      `[consultation-completed] Error processing consultation ${consultationId}:`,
      error instanceof Error ? error.message : error
    )
  }
}

export const config: SubscriberConfig = {
  event: "consultation.completed",
}
