/**
 * Tenant Audit Logs API Routes
 * 
 * GET /admin/tenant/audit-logs - Get audit logs for tenant's business
 * 
 * Automatically filters by the tenant's business_id
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../modules/compliance/service"

/**
 * GET /admin/tenant/audit-logs
 * Query audit logs scoped to the tenant's business
 * 
 * Query params:
 * - actor_id: Filter by actor ID
 * - actor_type: Filter by actor type
 * - entity_type: Filter by entity type
 * - entity_id: Filter by entity ID
 * - consultation_id: Filter by consultation ID
 * - order_id: Filter by order ID
 * - action: Filter by action
 * - risk_level: Filter by risk level
 * - flagged: Filter by flagged status (true/false)
 * - date_from: Filter by date range start
 * - date_to: Filter by date range end
 * - limit: Number of results (default: 50, max: 200)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    // Get tenant's business ID
    const businessId = (req as any).tenantContext?.businessId
    
    if (!businessId) {
      return res.status(400).json({
        error: "Tenant context required",
        message: "No business ID found in tenant context",
      })
    }

    // Parse query parameters
    const query = req.query as Record<string, any>
    const filters = {
      business_id: businessId, // Force business filter
      actor_id: query.actor_id,
      actor_type: query.actor_type,
      entity_type: query.entity_type,
      entity_id: query.entity_id,
      consultation_id: query.consultation_id,
      order_id: query.order_id,
      action: query.action,
      risk_level: query.risk_level,
      flagged: query.flagged !== undefined ? query.flagged === "true" : undefined,
      date_from: query.date_from ? new Date(query.date_from) : undefined,
      date_to: query.date_to ? new Date(query.date_to) : undefined,
      skip: parseInt(query.offset) || 0,
      take: Math.min(parseInt(query.limit) || 50, 200),
    }

    // Remove undefined filters
    Object.keys(filters).forEach((key) => {
      if (filters[key] === undefined) delete filters[key]
    })

    const result = await complianceService.queryAuditLogs(filters)

    res.json({
      logs: result.logs,
      count: result.count,
      total: result.total,
      limit: filters.take,
      offset: filters.skip,
    })
  } catch (error) {
    console.error("Error querying tenant audit logs:", error)
    res.status(500).json({
      error: "Failed to query audit logs",
      message: error.message,
    })
  }
}
