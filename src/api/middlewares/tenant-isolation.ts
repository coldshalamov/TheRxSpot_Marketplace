import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import ComplianceModuleService from "../../modules/compliance/service"

/**
 * Tenant Context from authentication
 */
export interface TenantContext {
  business_id: string
  user_id: string
  user_type: string
}

/**
 * Security event types for logging
 */
export type SecurityEventType = 
  | "UNAUTHORIZED_ACCESS_ATTEMPT"
  | "CROSS_TENANT_ACCESS_ATTEMPT"
  | "RESOURCE_ENUMERATION_ATTEMPT"
  | "PRIVILEGE_ESCALATION_ATTEMPT"

/**
 * Log a security event to the compliance audit log
 */
export async function logSecurityEvent(
  req: MedusaRequest,
  eventType: SecurityEventType,
  details: {
    resource: string
    resource_id: string
    attempted_by_business: string
    target_business_id?: string
  }
): Promise<void> {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )
    
    const userId = (req as any).auth_context?.actor_id || "unknown"
    const rawActorType = (req as any).auth_context?.actor_type || "business_user"
    const userType = rawActorType === "user" ? "business_user" : rawActorType
    const ipAddress = (req as any).ip || 
                      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
                      "unknown"
    const userAgent = req.headers["user-agent"] as string || "unknown"
    
    await complianceService.logAuditEvent({
      actor_type: userType as any,
      actor_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      action: "read",
      entity_type: details.resource as any,
      entity_id: details.resource_id,
      business_id: details.attempted_by_business,
      metadata: {
        security_event: eventType,
        attempted_by_business: details.attempted_by_business,
        target_business_id: details.target_business_id,
        message: `Security violation: ${eventType}`,
      },
      risk_level: "high",
      flagged: true,
    })
    
    // Also log to console for immediate visibility
    console.warn(`[SECURITY] ${eventType}:`, {
      resource: details.resource,
      resource_id: details.resource_id,
      attempted_by_business: details.attempted_by_business,
      target_business_id: details.target_business_id,
      user_id: userId,
      ip_address: ipAddress,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    // Don't fail the request if logging fails, but log the error
    console.error("Failed to log security event:", error)
  }
}

/**
 * Middleware to extract and validate tenant context
 * Must be used after authentication middleware
 */
export function requireTenantContext() {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    const authContext = (req as any).auth_context
    
    if (!authContext) {
      return res.status(401).json({
        message: "Unauthorized: No authentication context",
      })
    }
    
    // Extract business_id from auth context
    // Medusa's auth context may have different structures based on actor type
    const businessId = authContext.business_id || 
                       authContext.metadata?.business_id ||
                       authContext.app_metadata?.business_id
    
    if (!businessId) {
      return res.status(403).json({
        message: "Forbidden: No business context found",
      })
    }
    
    // Attach tenant context to request
    ;(req as any).tenant_context = {
      business_id: businessId,
      user_id: authContext.actor_id,
      user_type: authContext.actor_type,
    } as TenantContext
    
    next()
  }
}

/**
 * Verify that a resource belongs to the current tenant
 * Returns true if access is allowed, false if denied
 * Logs security violations
 */
export async function verifyTenantAccess(
  req: MedusaRequest,
  resourceType: string,
  resourceBusinessId: string | null | undefined
): Promise<boolean> {
  const tenantContext = (req as any).tenant_context as TenantContext | undefined
  
  if (!tenantContext) {
    return false
  }
  
  // If resource has no business_id, deny access (safety first)
  if (!resourceBusinessId) {
    await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
      resource: resourceType,
      resource_id: req.params.id || "unknown",
      attempted_by_business: tenantContext.business_id,
    })
    return false
  }
  
  // Check if business IDs match
  if (resourceBusinessId !== tenantContext.business_id) {
    await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
      resource: resourceType,
      resource_id: req.params.id || "unknown",
      attempted_by_business: tenantContext.business_id,
      target_business_id: resourceBusinessId,
    })
    return false
  }
  
  return true
}

/**
 * Create a 404 response for unauthorized access
 * Used to prevent ID enumeration attacks
 */
export function createNotFoundResponse(resourceType: string): {
  status: number
  body: { message: string }
} {
  return {
    status: 404,
    body: { message: `${resourceType} not found` },
  }
}
