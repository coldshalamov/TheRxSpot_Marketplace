/**
 * Admin Document Verification API Route
 * 
 * GET /admin/documents/:id/verify - Verify document integrity
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../../modules/compliance/service"

/**
 * GET /admin/documents/:id/verify
 * Verify document integrity using checksum
 * 
 * Returns:
 * - is_valid: Whether the document is valid
 * - checksum_match: Whether the checksum matches
 * - document_id: Document ID
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    const { id } = req.params
    const userId = (req as any).auth_context?.actor_id || "unknown"
    const userType = (req as any).auth_context?.actor_type || "business_user"

    // First verify access
    await complianceService.getDocument(id, userId, userType)

    // Verify integrity
    const result = await complianceService.verifyDocumentIntegrity(id)

    res.json({
      document_id: id,
      is_valid: result.is_valid,
      checksum_match: result.checksum_match,
      verified_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error verifying document:", error)
    
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
      error: "Failed to verify document",
      message: error.message,
    })
  }
}
