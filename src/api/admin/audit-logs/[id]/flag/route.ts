/**
 * Admin Audit Log Flag API Route
 * 
 * POST /admin/audit-logs/:id/flag - Flag or unflag an audit log
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../../modules/compliance/service"
import { getLogger } from "../../../../../utils/logger"

const logger = getLogger()

/**
 * POST /admin/audit-logs/:id/flag
 * Flag or unflag an audit log entry
 * 
 * Body:
 * - flagged: Boolean indicating whether to flag (true) or unflag (false)
 * - reason: Reason for flagging/unflagging (required)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    const { id } = req.params
    type FlagAuditLogBody = {
      reason?: string
      flagged?: boolean
    }
    const body = (req.body ?? {}) as FlagAuditLogBody

    // Validate input
    if (!body.reason) {
      return res.status(400).json({
        error: "Missing required field",
        message: "Reason is required for flagging/unflagging",
      })
    }

    const flagged = body.flagged !== false // Default to true

    // Update audit log
    const log = await complianceService.flagAuditLog(id, body.reason, flagged)

    res.json({
      log: {
        id: log.id,
        flagged: log.flagged,
        metadata: log.metadata,
      },
      message: flagged
        ? "Audit log flagged successfully"
        : "Audit log unflagged successfully",
    })
  } catch (error) {
    logger.error({ error }, "admin-audit-logs: failed to flag audit log")
    
    if (error.message?.includes("not found")) {
      return res.status(404).json({
        error: "Audit log not found",
        message: error.message,
      })
    }

    res.status(500).json({
      error: "Failed to flag audit log",
      message: error.message,
    })
  }
}
