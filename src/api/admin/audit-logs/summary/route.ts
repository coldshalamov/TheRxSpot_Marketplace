/**
 * Admin Audit Logs Summary API Route
 * 
 * GET /admin/audit-logs/summary - Get audit log statistics
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../modules/compliance/service"
import { getLogger } from "../../../../utils/logger"

const logger = getLogger()

/**
 * GET /admin/audit-logs/summary
 * Get audit log statistics
 * 
 * Query params:
 * - business_id: Filter by business ID
 * - date_from: Filter by date range start (ISO date)
 * - date_to: Filter by date range end (ISO date)
 * 
 * Returns:
 * - total_events: Total number of audit events
 * - events_by_type: Breakdown by action type
 * - events_by_risk_level: Breakdown by risk level
 * - flagged_events: Number of flagged events
 * - recent_events: Most recent events (last 5)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    // Parse query parameters
    const query = req.query as Record<string, any>
    const filters = {
      business_id: query.business_id,
      date_from: query.date_from ? new Date(query.date_from) : undefined,
      date_to: query.date_to ? new Date(query.date_to) : undefined,
    }

    // Remove undefined filters
    Object.keys(filters).forEach((key) => {
      if (filters[key] === undefined) delete filters[key]
    })

    const stats = await complianceService.getAuditLogStats(filters)

    res.json(stats)
  } catch (error) {
    logger.error({ error }, "admin-audit-logs-summary: failed to get stats")
    res.status(500).json({
      error: "Failed to get audit log statistics",
      message: error.message,
    })
  }
}
