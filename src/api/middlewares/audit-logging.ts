/**
 * Audit Logging Middleware
 * 
 * Automatically logs PHI (Protected Health Information) access for HIPAA compliance.
 * Intercepts requests to sensitive endpoints and creates audit log entries.
 * 
 * HIPAA-008: Includes URL parameter redaction to prevent PHI exposure in logs
 */

import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import ComplianceModuleService from "../../modules/compliance/service"
import { getLogger } from "../../utils/logger"

const logger = getLogger()

/**
 * Extended request type with audit context
 */
interface AuditRequest extends MedusaRequest {
  auditContext?: {
    actorId: string
    actorType: "customer" | "business_user" | "clinician" | "system" | "api_key"
    actorEmail?: string
  }
}

/**
 * Sensitive query parameters that should be redacted from logs
 * HIPAA-008: Prevents PHI exposure in audit logs
 */
const SENSITIVE_PARAMS = [
  "patient_id",
  "consultation_id",
  "customer_id",
  "email",
  "phone",
  "ssn",
  "dob",
  "date_of_birth",
  "mrn", // Medical Record Number
  "insurance_id",
  "prescription_id",
  "payment_method",
  "card_number",
  "cvv",
  "password",
  "token",
]

/**
 * Redact sensitive parameters from a URL
 * HIPAA-008: Prevents PHI from appearing in audit logs
 */
function redactSensitiveUrlParams(url: string): string {
  try {
    const urlObj = new URL(url, "http://localhost") // Base URL for relative URLs
    let hasRedaction = false
    
    SENSITIVE_PARAMS.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, "[REDACTED]")
        hasRedaction = true
      }
    })
    
    if (!hasRedaction) {
      return url
    }
    
    // Reconstruct URL with redacted params
    const pathname = urlObj.pathname
    const search = urlObj.searchParams.toString()
    return search ? `${pathname}?${search}` : pathname
  } catch {
    // If URL parsing fails, try simple regex replacement
    let redactedUrl = url
    SENSITIVE_PARAMS.forEach((param) => {
      const regex = new RegExp(`([?&])${param}=[^&]*`, "gi")
      redactedUrl = redactedUrl.replace(regex, `$1${param}=[REDACTED]`)
    })
    return redactedUrl
  }
}

/**
 * Redact sensitive fields from metadata
 */
function redactSensitiveMetadata(metadata: Record<string, any>): Record<string, any> {
  const redacted = { ...metadata }
  
  SENSITIVE_PARAMS.forEach((param) => {
    if (param in redacted) {
      redacted[param] = "[REDACTED]"
    }
  })
  
  return redacted
}

/**
 * Extract entity info from URL pattern
 */
function extractEntityInfo(url: string): { type: string; id: string } | null {
  // Match patterns like /admin/consultations/:id, /admin/patients/:id, etc.
  const patterns = [
    { regex: /\/admin\/consultations\/([^\/]+)/, type: "consultation" },
    { regex: /\/admin\/patients\/([^\/]+)/, type: "patient" },
    { regex: /\/admin\/documents\/([^\/]+)/, type: "document" },
    { regex: /\/admin\/orders\/([^\/]+)/, type: "order" },
    { regex: /\/admin\/businesses\/([^\/]+)/, type: "business" },
    { regex: /\/admin\/earnings\/([^\/]+)/, type: "earning" },
    { regex: /\/admin\/payouts\/([^\/]+)/, type: "payout" },
    { regex: /\/admin\/coupons\/([^\/]+)/, type: "coupon" },
    { regex: /\/admin\/custom\/consultations\/([^\/]+)/, type: "consultation" },
    { regex: /\/admin\/custom\/orders\/([^\/]+)/, type: "order" },
    { regex: /\/admin\/custom\/users\/([^\/]+)/, type: "user" },
    { regex: /\/store\/consultations\/([^\/]+)/, type: "consultation" },
    { regex: /\/store\/documents\/([^\/]+)/, type: "document" },
    { regex: /\/store\/orders\/([^\/]+)/, type: "order" },
    { regex: /\/store\/carts\/([^\/]+)/, type: "cart" },
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern.regex)
    if (match) {
      return { type: pattern.type, id: match[1] }
    }
  }

  return null
}

/**
 * Map HTTP method to audit action
 */
function mapMethodToAction(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "read"
    case "POST":
      return "create"
    case "PUT":
    case "PATCH":
      return "update"
    case "DELETE":
      return "delete"
    default:
      return "read"
  }
}

/**
 * Determine risk level based on action and entity
 */
function determineRiskLevel(action: string, entityType: string): "low" | "medium" | "high" | "critical" {
  // Critical: Delete operations on PHI
  if (action === "delete" && ["patient", "consultation", "document"].includes(entityType)) {
    return "critical"
  }

  // High: Export or bulk operations
  if (action === "export") {
    return "high"
  }

  // High: Downloads of sensitive documents
  if (action === "download") {
    return "high"
  }

  // Medium: Delete on non-PHI, Updates to PHI
  if (action === "delete" || (action === "update" && ["patient", "consultation"].includes(entityType))) {
    return "medium"
  }

  // Low: Everything else
  return "low"
}

/**
 * Get user info from request
 */
function getUserInfo(req: AuditRequest): { id: string; type: any; email?: string } {
  // Check for authenticated user (Medusa auth)
  const authContext = (req as any).auth_context
  if (authContext) {
    const normalizedActorType =
      authContext.actor_type === "user" ? "business_user" : authContext.actor_type

    return {
      id: authContext.actor_id || authContext.user_id || "unknown",
      type: normalizedActorType || "business_user",
      email: authContext.email,
    }
  }

  // Check for customer context
  const customerId = (req as any).customer_id
  if (customerId) {
    return {
      id: customerId,
      type: "customer",
    }
  }

  // Check for session
  const session = (req as any).session
  if (session?.user) {
    return {
      id: session.user.id,
      type: session.user.type || "business_user",
      email: session.user.email,
    }
  }

  // Default to system if no user context
  return {
    id: "system",
    type: "system",
  }
}

/**
 * Create audit log entry
 */
async function createAuditLog(
  req: AuditRequest,
  res: MedusaResponse,
  entityInfo: { type: string; id: string },
  action: string
) {
  try {
    // Get request container to access services
    const container = (req as any).scope
    if (!container) return

    const complianceService: ComplianceModuleService = container.resolve("complianceModuleService")
    if (!complianceService) return

    const userInfo = getUserInfo(req)
    const riskLevel = determineRiskLevel(action, entityInfo.type)

    // Get IP address
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      (req as any).ip

    // Get user agent
    const userAgent = req.headers["user-agent"] as string

    // Extract business/consultation/order IDs from query or body if available
    const body = (req.body ?? {}) as Record<string, any>
    const query = (req.query ?? {}) as Record<string, any>

    // HIPAA-008: Redact sensitive parameters from URL before logging
    const originalUrl = req.originalUrl || req.url || ""
    const redactedUrl = redactSensitiveUrlParams(originalUrl)

    // Redact sensitive metadata
    const metadata = redactSensitiveMetadata({
      url: redactedUrl,
      method: req.method,
      query: Object.keys(query),
    })

    await complianceService.logAuditEvent({
      actor_type: userInfo.type,
      actor_id: userInfo.id,
      actor_email: userInfo.email || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      action: action as any,
      entity_type: entityInfo.type as any,
      entity_id: entityInfo.id,
      business_id: body.business_id || query.business_id || null,
      consultation_id: body.consultation_id || query.consultation_id || null,
      order_id: body.order_id || query.order_id || null,
      changes: null, // Could capture before/after for updates
      metadata,
      risk_level: riskLevel,
      flagged: riskLevel === "critical" || riskLevel === "high",
    })
  } catch (error) {
    // Log error but don't fail the request
    logger.error({ error }, "audit-logging: failed to create audit log")
  }
}

/**
 * Main audit logging middleware
 * Logs all PHI access for HIPAA compliance
 */
export async function auditLoggingMiddleware(
  req: AuditRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  // Only log specific paths
  const auditPaths = [
    "/admin/consultations",
    "/admin/patients",
    "/admin/documents",
    "/admin/orders",
    "/admin/earnings",
    "/admin/payouts",
    "/admin/businesses",
    "/admin/custom",
    "/admin/coupons",
    "/store/documents",
    "/store/consultations",
    "/store/orders",
    "/store/carts",
  ]

  const shouldAudit = auditPaths.some((path) => req.path?.startsWith(path))
  
  if (!shouldAudit) {
    return next()
  }

  // Extract entity info from URL
  const entityInfo = extractEntityInfo(req.originalUrl || req.url || "")
  
  if (!entityInfo) {
    return next()
  }

  // Map HTTP method to action
  const action = mapMethodToAction(req.method || "GET")

  // Create audit log (fire and forget, don't block response)
  createAuditLog(req, res, entityInfo, action).catch((error) =>
    logger.error({ error }, "audit-logging: failed to create audit log")
  )

  next()
}

/**
 * Specific middleware for document access logging
 * More detailed logging for document operations
 */
export async function documentAuditMiddleware(
  req: AuditRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  // Extract document ID from URL
  const docMatch = req.path?.match(/\/documents\/([^\/]+)/)
  
  if (!docMatch) {
    return next()
  }

  const documentId = docMatch[1]
  const action = mapMethodToAction(req.method || "GET")
  
  // Log document access
  const userInfo = getUserInfo(req)
  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req as any).ip
  const userAgent = req.headers["user-agent"] as string

  // Fire and forget audit log
  const container = (req as any).scope
  if (container) {
    try {
      const complianceService: ComplianceModuleService = container.resolve("complianceModuleService")
      if (complianceService) {
        // HIPAA-008: Redact sensitive URL parameters
        const redactedUrl = redactSensitiveUrlParams(req.originalUrl || "")
        
        complianceService
          .logAuditEvent({
            actor_type: userInfo.type,
            actor_id: userInfo.id,
            actor_email: userInfo.email || null,
            ip_address: ipAddress || null,
            user_agent: userAgent || null,
            action: action === "read" && req.path?.includes("download") ? "download" : (action as any),
            entity_type: "document",
            entity_id: documentId,
            business_id: req.query?.business_id as string || null,
            consultation_id: req.query?.consultation_id as string || null,
            order_id: req.query?.order_id as string || null,
            changes: null,
            metadata: {
              url: redactedUrl,
              method: req.method,
            },
            risk_level: action === "delete" ? "high" : action === "download" ? "medium" : "low",
            flagged: action === "delete",
          })
          .catch((error) =>
            logger.error({ error }, "audit-logging: failed to create audit log")
          )
      }
    } catch (error) {
      logger.error({ error }, "audit-logging: failed to log document audit")
    }
  }

  next()
}

/**
 * Middleware for logging login/logout events
 */
export function createAuthAuditMiddleware(action: "login" | "logout") {
  return async (req: AuditRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const userInfo = getUserInfo(req)
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req as any).ip
    const userAgent = req.headers["user-agent"] as string

    const container = (req as any).scope
    if (container) {
      try {
        const complianceService: ComplianceModuleService = container.resolve("complianceModuleService")
        if (complianceService) {
          // HIPAA-008: Redact sensitive URL parameters
          const redactedUrl = redactSensitiveUrlParams(req.originalUrl || "")
          
          complianceService
            .logAuditEvent({
              actor_type: userInfo.type,
              actor_id: userInfo.id,
              actor_email: userInfo.email || null,
              ip_address: ipAddress || null,
              user_agent: userAgent || null,
              action,
              entity_type: "business",
              entity_id: userInfo.id,
              business_id: null,
              consultation_id: null,
              order_id: null,
              changes: null,
              metadata: {
                url: redactedUrl,
                method: req.method,
              },
              risk_level: "low",
              flagged: false,
            })
            .catch((error) =>
              logger.error({ error }, "audit-logging: failed to create audit log")
            )
        }
      } catch (error) {
        logger.error(
          { error, action },
          "audit-logging: failed to log audit action"
        )
      }
    }

    next()
  }
}

/**
 * Manual audit logging helper for use in route handlers
 * HIPAA-008: Automatically redacts sensitive parameters from URLs
 */
export async function logAuditEvent(
  req: AuditRequest,
  options: {
    action: "create" | "read" | "update" | "delete" | "download" | "login" | "logout" | "export"
    entityType: "consultation" | "order" | "document" | "patient" | "business" | "earning" | "payout"
    entityId: string
    businessId?: string
    consultationId?: string
    orderId?: string
    changes?: { before: Record<string, any> | null; after: Record<string, any> | null }
    riskLevel?: "low" | "medium" | "high" | "critical"
    metadata?: Record<string, any>
  }
) {
  const container = (req as any).scope
  if (!container) return

  try {
    const complianceService: ComplianceModuleService = container.resolve("complianceModuleService")
    if (!complianceService) return

    const userInfo = getUserInfo(req)
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req as any).ip
    const userAgent = req.headers["user-agent"] as string

    // HIPAA-008: Redact sensitive URL parameters
    const originalUrl = req.originalUrl || req.url || ""
    const redactedUrl = redactSensitiveUrlParams(originalUrl)

    // Redact sensitive metadata
    const redactedMetadata = redactSensitiveMetadata(options.metadata || {})

    await complianceService.logAuditEvent({
      actor_type: userInfo.type,
      actor_id: userInfo.id,
      actor_email: userInfo.email || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      action: options.action,
      entity_type: options.entityType,
      entity_id: options.entityId,
      business_id: options.businessId || null,
      consultation_id: options.consultationId || null,
      order_id: options.orderId || null,
      changes: options.changes || null,
      metadata: {
        ...redactedMetadata,
        url: redactedUrl,
      },
      risk_level: options.riskLevel || "low",
      flagged: (options.riskLevel === "high" || options.riskLevel === "critical"),
    })
  } catch (error) {
    logger.error({ error }, "audit-logging: failed to create manual audit log")
  }
}

/**
 * URL redaction helper for external use
 * HIPAA-008: Redact sensitive PHI from URLs before logging or display
 */
export function redactSensitiveUrl(url: string): string {
  return redactSensitiveUrlParams(url)
}

export default auditLoggingMiddleware
