/**
 * Admin Audit Logs API Routes
 * 
 * GET /admin/audit-logs - Query audit logs with filters
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../modules/compliance/service"

/**
 * GET /admin/audit-logs
 * Query audit logs with various filters
 * 
 * Query params:
 * - actor_id: Filter by actor ID
 * - actor_type: Filter by actor type (customer, business_user, clinician, system, api_key)
 * - entity_type: Filter by entity type (consultation, order, document, patient, business, earning, payout)
 * - entity_id: Filter by entity ID
 * - business_id: Filter by business ID
 * - consultation_id: Filter by consultation ID
 * - order_id: Filter by order ID
 * - action: Filter by action (create, read, update, delete, download, login, logout, export)
 * - risk_level: Filter by risk level (low, medium, high, critical)
 * - flagged: Filter by flagged status (true/false)
 * - date_from: Filter by date range start (ISO date)
 * - date_to: Filter by date range end (ISO date)
 * - limit: Number of results (default: 50, max: 200)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    // Parse query parameters
    const query = req.query as Record<string, any>
    const filters = {
      actor_id: query.actor_id,
      actor_type: query.actor_type,
      entity_type: query.entity_type,
      entity_id: query.entity_id,
      business_id: query.business_id,
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
    console.error("Error querying audit logs:", error)
    res.status(500).json({
      error: "Failed to query audit logs",
      message: error.message,
    })
  }
}
