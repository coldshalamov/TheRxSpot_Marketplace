/**
 * Automatic Logoff Middleware
 * 
 * HIPAA-001 Compliance: Automatic logoff after 15 minutes of inactivity
 * Implements session timeout controls to prevent unauthorized access to PHI
 * 
 * Requirements:
 * - Automatically log out users after 15 minutes of inactivity
 * - Update session's lastActivity timestamp on each request
 * - Return 401 with "Session expired" message when timeout occurs
 * - Log the automatic logoff event for audit
 * - Apply to all authenticated routes
 */

import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { logAuditEvent } from "./audit-logging"

/**
 * Extended request type with session activity tracking
 */
interface SessionActivityRequest extends MedusaRequest {
  session?: {
    id?: string
    user?: {
      id: string
      email?: string
      type?: string
    }
    customer_id?: string
    lastActivity?: number
    [key: string]: any
  }
}

/**
 * Default inactivity timeout in minutes (15 minutes for HIPAA compliance)
 */
const DEFAULT_TIMEOUT_MINUTES = 15

/**
 * Session key for last activity timestamp
 */
const LAST_ACTIVITY_KEY = "lastActivity"

/**
 * Check if request is for an authenticated route
 * Excludes public endpoints like login, register, password reset
 */
function isAuthenticatedRoute(req: MedusaRequest): boolean {
  const path = req.path || req.originalUrl || ""
  const method = req.method || "GET"
  
  // Public endpoints that don't require session validation
  const publicEndpoints = [
    // Auth endpoints
    { pattern: /^\/auth\//, methods: ["POST", "GET"] },
    // Customer registration
    { pattern: /^\/store\/customers$/, methods: ["POST"] },
    // Password reset
    { pattern: /^\/auth\/customer\/.*\/reset-password/, methods: ["POST"] },
    // Public store endpoints
    { pattern: /^\/store\/businesses/, methods: ["GET"] },
    { pattern: /^\/store\/product-categories/, methods: ["GET"] },
    // Health check
    { pattern: /^\/health/, methods: ["GET"] },
  ]
  
  // Check if this is a public endpoint
  for (const endpoint of publicEndpoints) {
    if (endpoint.pattern.test(path) && endpoint.methods.includes(method)) {
      return false
    }
  }
  
  return true
}

/**
 * Get user identifier from request for audit logging
 */
function getUserIdentifier(req: SessionActivityRequest): { id: string; type: string; email?: string } {
  // Check auth context (Medusa v2 style)
  const authContext = (req as any).auth_context
  if (authContext?.actor_id) {
    return {
      id: authContext.actor_id,
      type: authContext.actor_type || "business_user",
      email: authContext.email,
    }
  }
  
  // Check session user
  const session = req.session
  if (session?.user) {
    return {
      id: session.user.id,
      type: session.user.type || "business_user",
      email: session.user.email,
    }
  }
  
  // Check customer context
  const customerId = (req as any).customer_id
  if (customerId) {
    return {
      id: customerId,
      type: "customer",
    }
  }
  
  // Check customer in context
  const context = (req as any).context
  if (context?.customer?.id) {
    return {
      id: context.customer.id,
      type: "customer",
      email: context.customer.email,
    }
  }
  
  return {
    id: "unknown",
    type: "unknown",
  }
}

/**
 * Create the auto-logoff middleware with configurable timeout
 * 
 * @param timeoutMinutes - Inactivity timeout in minutes (default: 15)
 * @returns Express middleware function
 */
export function createAutoLogoffMiddleware(timeoutMinutes: number = DEFAULT_TIMEOUT_MINUTES) {
  const timeoutMs = timeoutMinutes * 60 * 1000
  
  return async (
    req: SessionActivityRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    // Skip public routes
    if (!isAuthenticatedRoute(req)) {
      return next()
    }
    
    const session = req.session
    
    // If no session exists, continue (may be handled by other auth middleware)
    if (!session) {
      return next()
    }
    
    // Check for existing last activity timestamp
    if (session[LAST_ACTIVITY_KEY]) {
      const lastActivity = session[LAST_ACTIVITY_KEY] as number
      const currentTime = Date.now()
      const inactiveMs = currentTime - lastActivity
      
      // Check if session has expired due to inactivity
      if (inactiveMs > timeoutMs) {
        const userInfo = getUserIdentifier(req)
        
        // Log the timeout event for HIPAA audit
        try {
          await logAuditEvent(req as any, {
            action: "logout",
            entityType: "business",
            entityId: userInfo.id,
            metadata: {
              reason: "session_timeout",
              timeout_minutes: timeoutMinutes,
              inactive_ms: inactiveMs,
              user_type: userInfo.type,
              user_email: userInfo.email,
            },
            riskLevel: "medium",
          })
        } catch (logError) {
          // Log error but don't prevent the security response
          console.error("[AutoLogoff] Failed to log session timeout:", logError)
        }
        
        // Clear the session to force re-authentication
        if (req.session) {
          // Destroy session data
          Object.keys(req.session).forEach(key => {
            delete (req.session as any)[key]
          })
        }
        
        // Return 401 Unauthorized with session expired message
        return res.status(401).json({
          code: "SESSION_EXPIRED",
          message: "Session expired",
          details: `Your session has expired due to ${timeoutMinutes} minutes of inactivity. Please log in again.`,
        })
      }
    }
    
    // Update last activity timestamp
    session[LAST_ACTIVITY_KEY] = Date.now()
    
    // Continue to next middleware
    next()
  }
}

/**
 * Pre-configured middleware with default 15-minute timeout
 * HIPAA-001 Compliance
 */
export const autoLogoffMiddleware = createAutoLogoffMiddleware(DEFAULT_TIMEOUT_MINUTES)

/**
 * Middleware factory for custom timeout configurations
 * Use for different user roles with different timeout requirements
 */
export const autoLogoffMiddlewareFactory = {
  /**
   * Standard 15-minute timeout for general users (HIPAA compliant)
   */
  standard: () => createAutoLogoffMiddleware(15),
  
  /**
   * Strict 5-minute timeout for high-privilege users (admin, clinicians)
   */
  strict: () => createAutoLogoffMiddleware(5),
  
  /**
   * Extended 30-minute timeout for special use cases (kiosks, trusted devices)
   * Note: Requires documented justification for HIPAA compliance
   */
  extended: () => createAutoLogoffMiddleware(30),
  
  /**
   * Custom timeout
   */
  custom: (minutes: number) => createAutoLogoffMiddleware(minutes),
}

export default autoLogoffMiddleware
