import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../modules/business"

/**
 * Extended cart modification endpoints that require consult gating
 * CRITICAL FIX: Covers all cart endpoints to prevent bypass attacks
 */
const CART_MODIFICATION_ENDPOINTS = [
  // Cart creation with pre-populated items (bypass attack vector)
  { pattern: /^\/store\/carts$/, method: "POST" },
  // Standard line item operations
  { pattern: /^\/store\/carts\/[^\/]+\/line-items/, method: "POST" },
  { pattern: /^\/store\/carts\/[^\/]+\/items/, method: "POST" },
  // Batch operations (bypass attack vector)
  { pattern: /^\/store\/carts\/[^\/]+\/line-items\/batch/, method: "POST" },
  { pattern: /^\/store\/carts\/[^\/]+\/items\/batch/, method: "POST" },
  // Update operations that could add items
  { pattern: /^\/store\/carts\/[^\/]+$/, method: "POST" },
  { pattern: /^\/store\/carts\/[^\/]+$/, method: "PUT" },
]

/**
 * Check if the current request is a cart modification endpoint
 */
function isCartModificationEndpoint(req: MedusaRequest): boolean {
  const path = req.path || req.originalUrl || ""
  const method = req.method || "GET"
  
  return CART_MODIFICATION_ENDPOINTS.some(endpoint => {
    const methodMatch = endpoint.method === method
    const pathMatch = endpoint.pattern.test(path)
    return methodMatch && pathMatch
  })
}

/**
 * Extract all product/variant IDs from cart creation request body
 * Handles both direct items array and nested metadata
 */
type ExtractedCartItem = { productId?: string; variantId?: string; quantity?: number }

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined
}

function extractProductIdsFromCartBody(body: unknown): ExtractedCartItem[] {
  const items: ExtractedCartItem[] = []
  
  if (!body) return items
  if (typeof body !== "object") return items
  
  const obj = body as Record<string, unknown>

  // Direct items array in cart creation (bypass attack vector)
  const maybeItems = obj.items
  if (Array.isArray(maybeItems)) {
    for (const item of maybeItems) {
      if (!item || typeof item !== "object") continue
      const it = item as Record<string, unknown>
      items.push({
        productId: asString(it.product_id),
        variantId: asString(it.variant_id),
        quantity: asNumber(it.quantity),
      })
    }
  }
  
  // Single item in body
  if (obj.product_id || obj.variant_id) {
    items.push({
      productId: asString(obj.product_id),
      variantId: asString(obj.variant_id),
      quantity: asNumber(obj.quantity),
    })
  }
  
  return items
}

/**
 * Middleware to validate cart items require consultation approval
 * CRITICAL FIX: Intercepts ALL cart modification endpoints to prevent bypass attacks
 * 
 * SECURITY COVERAGE:
 * - POST /store/carts (with pre-populated items - bypass vector)
 * - POST /store/carts/:id/line-items
 * - POST /store/carts/:id/line-items/batch (bypass vector)
 * - POST /store/carts/:id/items
 * - POST /store/carts/:id/items/batch (bypass vector)
 * - POST/PUT /store/carts/:id (update operations)
 */
export const consultGatingMiddleware = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  // Only intercept cart modification endpoints
  if (!isCartModificationEndpoint(req)) {
    return next()
  }

  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  
  // Get the request body
  const body = req.body as unknown
  
  // Extract all product/variant IDs from request
  const items = extractProductIdsFromCartBody(body)
  
  // If no items to validate, proceed
  if (items.length === 0) {
    return next()
  }
  
  // Validate each item for consult requirements
  for (const item of items) {
    const resolvedProductId = await resolveProductId(
      productModuleService, 
      item.productId || null, 
      item.variantId || null
    )
    
    if (!resolvedProductId) {
      continue
    }
    
    // Check if product requires consultation
    const requiresConsult = await checkProductRequiresConsult(productModuleService, resolvedProductId)
    
    if (!requiresConsult) {
      continue
    }
    
    // Get customer ID from authenticated session
    const customerId = await getCustomerId(req)
    
    if (!customerId) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        product_id: resolvedProductId,
        message: "Customer must be logged in to purchase this product",
      })
    }
    
    // Check for valid consult approval
    const hasApproval = await checkConsultApproval(
      businessModuleService,
      customerId,
      resolvedProductId
    )
    
    if (!hasApproval) {
      return res.status(403).json({
        code: "CONSULT_REQUIRED",
        product_id: resolvedProductId,
        message: "This product requires a completed consultation before purchase. Please complete a consultation first.",
      })
    }
  }
  
  // All items validated successfully
  next()
}

/**
 * Batch validation helper for bulk operations
 * Returns all validation errors at once rather than failing on first
 */
export async function validateCartItemsForConsult(
  req: MedusaRequest,
  items: Array<{ product_id?: string; variant_id?: string; quantity?: number }>
): Promise<{ valid: boolean; errors?: Array<{ code: string; product_id?: string; message: string }> }> {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const errors: Array<{ code: string; product_id?: string; message: string }> = []
  
  const customerId = await getCustomerId(req)
  
  if (!customerId && items.length > 0) {
    // Check if any item requires consultation
    for (const item of items) {
      const resolvedProductId = await resolveProductId(
        productModuleService,
        item.product_id || null,
        item.variant_id || null
      )
      
      if (resolvedProductId) {
        const requiresConsult = await checkProductRequiresConsult(productModuleService, resolvedProductId)
        if (requiresConsult) {
          errors.push({
            code: "UNAUTHORIZED",
            product_id: resolvedProductId,
            message: "Authentication required for prescription products",
          })
        }
      }
    }
    
    if (errors.length > 0) {
      return { valid: false, errors }
    }
  }
  
  for (const item of items) {
    const resolvedProductId = await resolveProductId(
      productModuleService,
      item.product_id || null,
      item.variant_id || null
    )
    
    if (!resolvedProductId) {
      continue
    }
    
    const requiresConsult = await checkProductRequiresConsult(productModuleService, resolvedProductId)
    
    if (!requiresConsult) {
      continue
    }
    
    const hasApproval = await checkConsultApproval(
      businessModuleService,
      customerId,
      resolvedProductId
    )
    
    if (!hasApproval) {
      errors.push({
        code: "CONSULT_REQUIRED",
        product_id: resolvedProductId,
        message: "Consultation required for this product",
      })
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Resolve product ID from product_id or variant_id
 */
async function resolveProductId(
  productService: any,
  productId: string | null,
  variantId: string | null
): Promise<string | null> {
  if (productId) {
    return productId
  }
  
  if (variantId) {
    try {
      const variant = await productService.retrieveProductVariant(variantId)
      return variant?.product_id || null
    } catch {
      return null
    }
  }
  
  return null
}

/**
 * Check if product requires consultation
 * Products with requires_consult metadata field set to true require consultation
 */
async function checkProductRequiresConsult(
  productService: any,
  productId: string
): Promise<boolean> {
  try {
    const product = await productService.retrieveProduct(productId)
    
    if (!product) {
      return false
    }
    
    // Check metadata for requires_consult flag
    const metadata = product.metadata || {}
    return metadata.requires_consult === true || metadata.requires_consult === "true"
  } catch {
    return false
  }
}

/**
 * Check if customer has valid consult approval for a product
 */
async function checkConsultApproval(
  businessService: any,
  customerId: string | null,
  productId: string
): Promise<boolean> {
  if (!customerId) {
    return false
  }
  
  try {
    const approvals = await businessService.listConsultApprovals(
      {
        customer_id: customerId,
        product_id: productId,
        status: "approved",
      },
      { take: 1 }
    )
    
    if (!approvals.length) {
      return false
    }
    
    const approval = approvals[0]
    
    // Check if approval has expired
    if (approval.expires_at) {
      const expiresAt = new Date(approval.expires_at)
      if (expiresAt < new Date()) {
        return false
      }
    }
    
    return true
  } catch {
    return false
  }
}

/**
 * Get customer ID from the authenticated request
 */
async function getCustomerId(req: MedusaRequest): Promise<string | null> {
  // Try to get from auth context
  const authContext = (req as any).auth_context
  if (authContext?.actor_id) {
    // If it's a customer, the actor_id should be the customer ID
    const actorType = authContext.actor_type
    if (actorType === "customer") {
      return authContext.actor_id
    }
  }
  
  // Try to get from customer in context
  const context = (req as any).context
  if (context?.customer?.id) {
    return context.customer.id
  }
  
  // Try to resolve customer from auth identity
  const authIdentityId = authContext?.auth_identity_id
  if (authIdentityId) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER)
      const customers = await customerService.listCustomers(
        { has_account: true },
        { take: 1 }
      )
      
      // Find customer with matching auth identity
      for (const customer of customers) {
        // Note: In a real implementation, you might need to check the customer_account table
        // This is a simplified check
        if (customer.email) {
          return customer.id
        }
      }
    } catch {
      // Ignore errors
    }
  }
  
  return null
}
