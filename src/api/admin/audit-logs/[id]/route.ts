/**
 * Admin Audit Log Detail API Routes
 * 
 * GET /admin/audit-logs/:id - Get audit log detail
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../modules/compliance/service"

/**
 * GET /admin/audit-logs/:id
 * Get detailed information about a specific audit log entry
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    const { id } = req.params

    // Query for specific log
    const result = await complianceService.queryAuditLogs({
      entity_id: id,
      take: 1,
    })

    if (result.logs.length === 0) {
      return res.status(404).json({
        error: "Audit log not found",
        message: `No audit log found with ID: ${id}`,
      })
    }

    res.json({
      log: result.logs[0],
    })
  } catch (error) {
    console.error("Error getting audit log:", error)
    res.status(500).json({
      error: "Failed to get audit log",
      message: error.message,
    })
  }
}
