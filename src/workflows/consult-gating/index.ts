import {
  createWorkflow,
  WorkflowResponse,
  createStep,
  StepResponse,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../modules/business"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Input type for consult approval validation workflow
 */
export type ValidateConsultApprovalInput = {
  customer_id: string
  product_id: string
  business_id?: string
}

/**
 * Output type for consult approval validation workflow
 */
export type ValidateConsultApprovalOutput = {
  valid: boolean
  approval_id?: string
  expires_at?: Date
  message?: string
}

/**
 * Input type for cart checkout validation
 * CRITICAL FIX: Workflow-level validation at checkout (final gate)
 */
export type ValidateCartCheckoutInput = {
  cart_id: string
  customer_id?: string
}

/**
 * Output type for cart checkout validation
 */
export type ValidateCartCheckoutOutput = {
  valid: boolean
  errors?: Array<{
    product_id: string
    product_title?: string
    code: string
    message: string
  }>
}

/**
 * Step to check if product requires consultation
 */
type CheckProductRequiresConsultOutput = {
  valid: boolean
  requires_consult: boolean
  message?: string
}

const checkProductRequiresConsultStep = createStep<
  ValidateConsultApprovalInput,
  CheckProductRequiresConsultOutput,
  CheckProductRequiresConsultOutput
>(
  "check-product-requires-consult",
  async (
    input: ValidateConsultApprovalInput,
    { container }
  ) => {
    const productService = container.resolve(Modules.PRODUCT)
    
    try {
      const product = await productService.retrieveProduct(input.product_id)
      
      if (!product) {
        return new StepResponse<CheckProductRequiresConsultOutput>({
          valid: false,
          requires_consult: false,
          message: "Product not found",
        })
      }
      
      // Check metadata for requires_consult flag
      const metadata = product.metadata || {}
      const requiresConsult = metadata.requires_consult === true || 
                              metadata.requires_consult === "true"
      
      return new StepResponse<CheckProductRequiresConsultOutput>({
        valid: true,
        requires_consult: requiresConsult,
        message: "OK",
      })
    } catch (error) {
      return new StepResponse<CheckProductRequiresConsultOutput>({
        valid: false,
        requires_consult: false,
        message: `Error checking product: ${error.message}`,
      })
    }
  }
)

/**
 * Step to check for valid consult approval
 */
const checkConsultApprovalStep = createStep<
  ValidateConsultApprovalInput & { requires_consult: boolean },
  ValidateConsultApprovalOutput,
  ValidateConsultApprovalOutput
>(
  "check-consult-approval",
  async (
    input: ValidateConsultApprovalInput & { requires_consult: boolean },
    { container }
  ) => {
    if (!input.requires_consult) {
      return new StepResponse<ValidateConsultApprovalOutput, ValidateConsultApprovalOutput>({
        valid: true,
        message: "Product does not require consultation",
      })
    }
    
    const businessService = container.resolve(BUSINESS_MODULE)
    
    try {
      // Query for valid approvals
      const query: any = {
        customer_id: input.customer_id,
        product_id: input.product_id,
        status: "approved",
      }
      
      // Optionally filter by business
      if (input.business_id) {
        query.business_id = input.business_id
      }
      
      const approvals = await businessService.listConsultApprovals(
        query,
        { order: { approved_at: "DESC" }, take: 1 }
      )
      
      if (!approvals.length) {
        return new StepResponse<ValidateConsultApprovalOutput, ValidateConsultApprovalOutput>({
          valid: false,
          message: "No valid consultation approval found for this product",
        })
      }
      
      const approval = approvals[0]
      
      // Check if approval has expired
      if (approval.expires_at) {
        const expiresAt = new Date(approval.expires_at)
        if (expiresAt < new Date()) {
          return new StepResponse<ValidateConsultApprovalOutput, ValidateConsultApprovalOutput>({
            valid: false,
            message: "Consultation approval has expired. Please request a new consultation.",
          })
        }
      }
      
      return new StepResponse<ValidateConsultApprovalOutput, ValidateConsultApprovalOutput>({
        valid: true,
        approval_id: approval.id,
        expires_at: approval.expires_at ?? undefined,
        message: "Valid consultation approval found",
      })
    } catch (error) {
      return new StepResponse<ValidateConsultApprovalOutput, ValidateConsultApprovalOutput>({
        valid: false,
        message: `Error checking approval: ${error.message}`,
      })
    }
  }
)

/**
 * CRITICAL FIX: Step to validate ALL cart items have consult approvals before order completion
 * This is the FINAL GATE at checkout to prevent bypass attacks
 * 
 * SECURITY: This step runs during checkout completion and validates:
 * 1. All items requiring consultation have valid approvals
 * 2. No approvals have expired
 * 3. Customer is authenticated (if required)
 * 
 * This prevents bypass attacks that might:
 * - Add items after middleware validation
 * - Exploit race conditions
 * - Use direct order creation APIs
 */
const validateCartConsultApprovalsStep = createStep(
  "validate-cart-consult-approvals",
  async (
    input: ValidateCartCheckoutInput,
    { container }
  ): Promise<StepResponse<ValidateCartCheckoutOutput>> => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const businessService = container.resolve(BUSINESS_MODULE)
    
    try {
      // Retrieve cart with all items and product details
      const { data: carts } = await query.graph({
        entity: "cart",
        fields: [
          "id",
          "items.id",
          "items.product.id",
          "items.product.title",
          "items.product.metadata",
          "items.product.variants.id",
          "customer_id",
          "email",
        ],
        filters: { id: input.cart_id },
      })
      
      const cart = carts[0]
      
      if (!cart) {
        return new StepResponse({
          valid: false,
          errors: [{
            product_id: "",
            code: "CART_NOT_FOUND",
            message: "Cart not found",
          }],
        })
      }
      
      if (!cart.items || cart.items.length === 0) {
        // Empty cart - nothing to validate
        return new StepResponse({ valid: true })
      }
      
      const errors: Array<{
        product_id: string
        product_title?: string
        code: string
        message: string
      }> = []
      
      // Get customer identifier
      const customerId = input.customer_id || cart.customer_id || cart.email
      
      // Validate each cart item
      for (const item of (cart.items ?? []) as any[]) {
        const product = item?.product as any
        
        if (!product) continue
        
        // Check if product requires consultation
        const metadata = product.metadata || {}
        const requiresConsult = metadata.requires_consult === true || 
                                metadata.requires_consult === "true"
        
        if (!requiresConsult) continue
        
        // Product requires consultation - validate approval
        if (!customerId) {
          errors.push({
            product_id: product.id,
            product_title: product.title,
            code: "AUTH_REQUIRED",
            message: `Authentication required for prescription product: ${product.title}`,
          })
          continue
        }
        
        // Query for valid approvals
        const approvals = await businessService.listConsultApprovals(
          {
            customer_id: customerId,
            product_id: product.id,
            status: "approved",
          },
          { order: { approved_at: "DESC" }, take: 1 }
        )
        
        if (approvals.length === 0) {
          errors.push({
            product_id: product.id,
            product_title: product.title,
            code: "CONSULT_REQUIRED",
            message: `Consultation required for: ${product.title}. Please complete a consultation before checkout.`,
          })
          continue
        }
        
        // Check if approval has expired
        const approval = approvals[0]
        if (approval.expires_at) {
          const expiresAt = new Date(approval.expires_at)
          if (expiresAt < new Date()) {
            errors.push({
              product_id: product.id,
              product_title: product.title,
              code: "CONSULT_EXPIRED",
              message: `Consultation approval expired for: ${product.title}. Please request a new consultation.`,
            })
          }
        }
      }
      
      return new StepResponse({
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      })
    } catch (error) {
      console.error("[validateCartConsultApprovalsStep] Error:", error)
      return new StepResponse({
        valid: false,
        errors: [{
          product_id: "",
          code: "VALIDATION_ERROR",
          message: `Failed to validate cart: ${error.message}`,
        }],
      })
    }
  }
)

/**
 * Step to create a new consult approval (for internal use)
 */
type CreateConsultApprovalOutput = {
  success: boolean
  approval_id: string
  message: string
}

const createConsultApprovalStep = createStep<
  {
    customer_id: string
    product_id: string
    business_id: string
    consultation_id?: string
    approved_by?: string
    expires_at?: Date
  },
  CreateConsultApprovalOutput,
  CreateConsultApprovalOutput
>(
  "create-consult-approval",
  async (
    input: {
      customer_id: string
      product_id: string
      business_id: string
      consultation_id?: string
      approved_by?: string
      expires_at?: Date
    },
    { container }
  ) => {
    const businessService = container.resolve(BUSINESS_MODULE)
    
    try {
      const approval = await businessService.createConsultApprovals({
        customer_id: input.customer_id,
        product_id: input.product_id,
        business_id: input.business_id,
        status: "approved",
        consultation_id: input.consultation_id,
        approved_by: input.approved_by,
        approved_at: new Date(),
        expires_at: input.expires_at,
      })
      
      return new StepResponse<CreateConsultApprovalOutput>({
        success: true,
        approval_id: approval.id,
        message: "OK",
      })
    } catch (error) {
      return new StepResponse<CreateConsultApprovalOutput>({
        success: false,
        approval_id: "",
        message: `Failed to create approval: ${error.message}`,
      })
    }
  }
)

/**
 * Workflow to validate consult approval for a customer and product
 */
export const validateConsultApprovalWorkflow = createWorkflow(
  "validate-consult-approval",
  (input: ValidateConsultApprovalInput) => {
    const productCheck = checkProductRequiresConsultStep(input)

    const approvalInput = transform({ input, productCheck }, (d) => ({
      ...d.input,
      requires_consult: d.productCheck.requires_consult,
    }))

    const approvalCheck = checkConsultApprovalStep(approvalInput)
    
    return new WorkflowResponse(approvalCheck)
  }
)

/**
 * CRITICAL FIX: Workflow to validate ALL cart items at checkout
 * This is the FINAL GATE to prevent consult gating bypass attacks
 * 
 * Call this workflow during checkout completion before creating the order
 * to ensure all items have required consultation approvals.
 */
export const validateCartCheckoutWorkflow = createWorkflow(
  "validate-cart-checkout",
  (input: ValidateCartCheckoutInput) => {
    const validation = validateCartConsultApprovalsStep(input)
    
    return new WorkflowResponse(validation)
  }
)

/**
 * Workflow to create a new consult approval
 * This is typically called after a consultation is completed
 */
export const createConsultApprovalWorkflow = createWorkflow(
  "create-consult-approval",
  (
    input: {
      customer_id: string
      product_id: string
      business_id: string
      consultation_id?: string
      approved_by?: string
      expires_at?: Date
    }
  ) => {
    const result = createConsultApprovalStep(input)
    return new WorkflowResponse(result)
  }
)

/**
 * Re-export step types for external use
 */
export { checkProductRequiresConsultStep, checkConsultApprovalStep, createConsultApprovalStep, validateCartConsultApprovalsStep }
