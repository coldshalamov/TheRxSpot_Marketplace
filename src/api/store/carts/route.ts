import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Store Carts API Extension
 * 
 * This file extends the default Medusa cart functionality with:
 * - Business context injection for multi-tenant carts
 * - Consult gating validation hooks
 * 
 * Note: Core cart operations (create, update, add items) are handled by Medusa's
 * default store cart routes. This file provides additional business-aware endpoints.
 */

/**
 * POST /store/carts
 * Create a new cart with business context
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const cartService = req.scope.resolve(Modules.CART)
  const business = (req as any).context?.business
  
  try {
    // Create cart with optional business context
    const body = (req.body ?? {}) as Record<string, any>
    const cartData: any = {
      ...body,
    }
    
    // If a business context exists, store it in cart metadata
    if (business) {
      cartData.metadata = {
        ...cartData.metadata,
        business_id: business.id,
        business_name: business.name,
        sales_channel_id: business.sales_channel_id,
      }
      
      // Use the business's sales channel if available
      if (business.sales_channel_id) {
        cartData.sales_channel_id = business.sales_channel_id
      }
    }
    
    // Create the cart using Medusa's cart service
    const cart = await cartService.createCarts(cartData)
    
    res.status(200).json({ cart })
  } catch (error) {
    console.error("Error creating cart:", error)
    res.status(500).json({
      code: "CART_CREATE_ERROR",
      message: error.message,
    })
  }
}

/**
 * GET /store/carts/:id
 * Retrieve a cart with business context
 * 
 * Note: This is handled by Medusa's default route.
 * The consult-gating middleware validates items on add/update.
 */

/**
 * Helper function to validate cart items against consult requirements
 * This can be called manually or is automatically triggered by middleware
 */
export async function validateCartConsultApprovals(
  req: MedusaRequest,
  cartId: string
): Promise<{ valid: boolean; errors?: any[] }> {
  const cartService = req.scope.resolve(Modules.CART)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const businessService = req.scope.resolve("businessModuleService")
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  try {
    // Retrieve cart with items
    const { data: [cart] } = await query.graph({
      entity: "cart",
      fields: ["id", "items.*", "items.product.*", "email", "customer_id"],
      filters: { id: cartId },
    })
    
    if (!cart || !cart.items || cart.items.length === 0) {
      return { valid: true }
    }
    
    const errors: any[] = []
    
    // Check each cart item
    for (const item of cart.items) {
      const product = item.product
      
      if (!product) continue
      
      // Check if product requires consultation
      const metadata = product.metadata || {}
      const requiresConsult = metadata.requires_consult === true || 
                              metadata.requires_consult === "true"
      
      if (!requiresConsult) continue
      
      // Get customer identifier
      const customerId = cart.customer_id || cart.email
      
      if (!customerId) {
        errors.push({
          item_id: item.id,
          product_id: product.id,
          code: "AUTH_REQUIRED",
          message: "Authentication required for prescription products",
        })
        continue
      }
      
      // Check for valid consult approval
      const approvals = await businessService.listConsultApprovals(
        {
          customer_id: customerId,
          product_id: product.id,
          status: "approved",
        },
        { take: 1 }
      )
      
      if (approvals.length === 0) {
        errors.push({
          item_id: item.id,
          product_id: product.id,
          product_title: product.title,
          code: "CONSULT_REQUIRED",
          message: `Consultation required for ${product.title}`,
        })
        continue
      }
      
      // Check if approval has expired
      const approval = approvals[0]
      if (approval.expires_at) {
        const expiresAt = new Date(approval.expires_at)
        if (expiresAt < new Date()) {
          errors.push({
            item_id: item.id,
            product_id: product.id,
            product_title: product.title,
            code: "CONSULT_EXPIRED",
            message: `Consultation approval for ${product.title} has expired`,
          })
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error("Error validating cart consult approvals:", error)
    return {
      valid: false,
      errors: [{
        code: "VALIDATION_ERROR",
        message: error.message,
      }],
    }
  }
}

/**
 * Extend cart creation with business validation
 * This hook is called after cart creation
 */
export async function afterCartCreate(
  req: MedusaRequest,
  cart: any
): Promise<void> {
  const business = (req as any).context?.business
  
  if (business && cart) {
    // Store business context in cart metadata
    const cartService = req.scope.resolve(Modules.CART)
    
    await cartService.updateCarts(cart.id, {
      metadata: {
        ...cart.metadata,
        business_id: business.id,
        business_name: business.name,
      },
    })
  }
}
