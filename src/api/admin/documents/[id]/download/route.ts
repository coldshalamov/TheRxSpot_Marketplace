/**
 * Admin Document Download API Route
 * 
 * GET /admin/documents/:id/download - Get signed download URL
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../../modules/compliance/service"

/**
 * GET /admin/documents/:id/download
 * Generate a signed download URL for a document
 * 
 * Query params:
 * - expires_in: URL expiration time in seconds (default: 3600, max: 86400)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    const { id } = req.params
    const userId = (req as any).auth_context?.actor_id || "unknown"
    const userType = (req as any).auth_context?.actor_type || "business_user"

    // Parse expiration time
    const query = req.query as Record<string, any>
    const expiresIn = Math.min(
      parseInt(query.expires_in) || 3600,
      86400 // Max 24 hours
    )

    // Get signed URL
    const result = await complianceService.getSignedDownloadUrl(
      id,
      userId,
      userType,
      expiresIn
    )

    res.json({
      download_url: result.url,
      expires_at: result.expires_at.toISOString(),
      document_id: id,
    })
  } catch (error) {
    console.error("Error generating download URL:", error)
    
    if (error.message?.includes("not found")) {
      return res.status(404).json({
        error: "Document not found",
        message: error.message,
      })
    }
    
    if (error.message?.includes("Access denied")) {
      return res.status(403).json({
        error: "Access denied",
        message: error.message,
      })
    }

    res.status(500).json({
      error: "Failed to generate download URL",
      message: error.message,
    })
  }
}
