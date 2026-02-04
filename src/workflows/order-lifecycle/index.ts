import {
  createWorkflow,
  WorkflowResponse,
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../modules/business"
import { FINANCIALS_MODULE } from "../../modules/financials"

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["consult_pending", "payment_captured", "cancelled"],
  consult_pending: ["consult_complete", "consult_rejected", "cancelled"],
  consult_complete: ["payment_captured", "cancelled"],
  consult_rejected: ["cancelled", "refunded"],
  payment_captured: ["processing", "cancelled"],
  processing: ["fulfilled", "cancelled"],
  fulfilled: ["delivered", "cancelled"],
  delivered: [],
  cancelled: ["refunded"],
  refunded: [],
}

// Order status type
export type OrderStatus =
  | "pending"
  | "consult_pending"
  | "consult_complete"
  | "consult_rejected"
  | "payment_captured"
  | "processing"
  | "fulfilled"
  | "delivered"
  | "cancelled"
  | "refunded"

interface ValidateTransitionInput {
  orderId: string
  fromStatus: string
  toStatus: string
}

interface StatusUpdateInput {
  orderId: string
  fromStatus: string
  toStatus: string
  changedBy?: string
  reason?: string
}

/**
 * Step: Validate status transition
 */
const validateTransitionStep = createStep(
  "validate-status-transition",
  async (input: ValidateTransitionInput, { container }) => {
    const { orderId, fromStatus, toStatus } = input

    // Get current order status from OrderModule
    const orderService = container.resolve(Modules.ORDER)
    const order = await orderService.retrieveOrder(orderId)

    if (!order) {
      throw new Error(`Order not found: ${orderId}`)
    }

    // Check if the fromStatus matches current order status
    const currentStatus = (order.metadata?.custom_status as string) || fromStatus
    if (currentStatus !== fromStatus) {
      throw new Error(
        `Status mismatch: expected ${fromStatus}, but order is ${currentStatus}`
      )
    }

    // Validate transition
    const allowedTransitions = VALID_TRANSITIONS[fromStatus] || []
    if (!allowedTransitions.includes(toStatus)) {
      throw new Error(
        `Invalid status transition from '${fromStatus}' to '${toStatus}'. Allowed: ${allowedTransitions.join(", ")}`
      )
    }

    return new StepResponse({ valid: true, order })
  }
)

/**
 * Step: Update order status metadata
 */
const updateOrderStatusStep = createStep(
  "update-order-status",
  async (
    input: { orderId: string; toStatus: OrderStatus; order: any },
    { container }
  ) => {
    const { orderId, toStatus, order } = input

    // Update order metadata with custom status
    const orderService = container.resolve(Modules.ORDER)
    await orderService.updateOrders(orderId, {
      metadata: {
        ...order.metadata,
        custom_status: toStatus,
        status_updated_at: new Date().toISOString(),
      },
    })

    return new StepResponse({ updated: true })
  }
)

/**
 * Step: Create OrderStatusEvent record
 */
const createStatusEventStep = createStep(
  "create-status-event",
  async (
    input: {
      orderId: string
      fromStatus: string
      toStatus: string
      changedBy?: string
      reason?: string
    },
    { container }
  ) => {
    const businessService = container.resolve(BUSINESS_MODULE)

    const event = await businessService.createOrderStatusEvents({
      order_id: input.orderId,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      changed_by: input.changedBy ?? null,
      reason: input.reason ?? null,
      metadata: null,
    })

    return new StepResponse(event)
  }
)

/**
 * Step: Update earnings when order delivered
 */
const updateEarningsOnDeliveryStep = createStep(
  "update-earnings-on-delivery",
  async (
    input: { orderId: string; toStatus: OrderStatus },
    { container }
  ) => {
    if (input.toStatus !== "delivered") {
      return new StepResponse({ earningsUpdated: false })
    }

    const financialsService = container.resolve(FINANCIALS_MODULE)
    await financialsService.makeEarningsAvailable(input.orderId)

    return new StepResponse({ earningsUpdated: true })
  }
)

/**
 * Step: Cancel earnings when order cancelled
 */
const cancelEarningsStep = createStep(
  "cancel-earnings",
  async (
    input: { orderId: string; toStatus: OrderStatus },
    { container }
  ) => {
    if (input.toStatus !== "cancelled" && input.toStatus !== "refunded") {
      return new StepResponse({ earningsCancelled: false })
    }

    const financialsService = container.resolve(FINANCIALS_MODULE)
    await financialsService.cancelEarnings(input.orderId)

    return new StepResponse({ earningsCancelled: true })
  }
)

/**
 * Main workflow: Order status transition
 */
export const orderStatusTransitionWorkflow = createWorkflow(
  "order-status-transition",
  (input: StatusUpdateInput) => {
    // Step 1: Validate transition
    const validation = validateTransitionStep({
      orderId: input.orderId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
    })

    // Step 2: Create status event record
    const statusEvent = createStatusEventStep({
      orderId: input.orderId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      changedBy: input.changedBy,
      reason: input.reason,
    })

    // Step 3: Update order status
    const orderUpdate = updateOrderStatusStep({
      orderId: input.orderId,
      toStatus: input.toStatus as OrderStatus,
      order: validation.order,
    })

    // Step 4: Update earnings if delivered
    const earningsUpdate = updateEarningsOnDeliveryStep({
      orderId: input.orderId,
      toStatus: input.toStatus as OrderStatus,
    })

    // Step 5: Cancel earnings if cancelled/refunded
    const earningsCancel = cancelEarningsStep({
      orderId: input.orderId,
      toStatus: input.toStatus as OrderStatus,
    })

    return new WorkflowResponse({
      success: true,
      event: statusEvent,
      orderUpdated: orderUpdate.updated,
      earningsUpdated: earningsUpdate.earningsUpdated,
      earningsCancelled: earningsCancel.earningsCancelled,
    })
  }
)

/**
 * Workflow: Initialize order with consult status
 */
export const initializeOrderWorkflow = createWorkflow(
  "initialize-order",
  (input: {
    orderId: string
    requiresConsultation: boolean
    businessId: string
    items: any[]
  }) => {
    const initialStatus: OrderStatus = input.requiresConsultation
      ? "consult_pending"
      : "pending"

    // Create initial status event
    const statusEvent = createStatusEventStep({
      orderId: input.orderId,
      fromStatus: "pending",
      toStatus: initialStatus,
      changedBy: "system",
      reason: input.requiresConsultation
        ? "Order requires consultation"
        : "Standard order",
    })

    // Update order metadata with initial status
    // Note: Order is created by Medusa, we just add our custom status

    return new WorkflowResponse({
      status: initialStatus,
      event: statusEvent,
    })
  }
)

/**
 * Workflow: Complete consultation and advance order
 */
export const completeConsultationWorkflow = createWorkflow(
  "complete-consultation-order",
  (input: {
    orderId: string
    consultationId: string
    outcome: "approved" | "rejected"
    approvedMedications?: string[]
    clinicianId?: string
  }) => {
    const toStatus: OrderStatus =
      input.outcome === "approved" ? "consult_complete" : "consult_rejected"

    // Transition order status
    // Note: This would be called after the consultation workflow
    const result = {
      orderId: input.orderId,
      newStatus: toStatus,
      consultationId: input.consultationId,
    }

    return new WorkflowResponse(result)
  }
)
