/**
 * Store (Patient) Document Download API Route
 * 
 * GET /store/documents/:id/download - Get download URL for patient document
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../../modules/compliance/service"

/**
 * GET /store/documents/:id/download
 * Generate a signed download URL for a patient document
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
    const patientId = (req as any).customer?.id
    
    if (!patientId) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please log in to download documents",
      })
    }

    // Parse expiration time
    const query = req.query as Record<string, any>
    const expiresIn = Math.min(
      parseInt(query.expires_in) || 3600,
      86400 // Max 24 hours
    )

    // First verify document belongs to patient and is accessible
    const document = (await complianceService.getDocument(id, patientId, "patient")) as any
    
    if (document.patient_id !== patientId) {
      return res.status(403).json({
        error: "Access denied",
        message: "You do not have access to this document",
      })
    }

    // Only allow access to patient_only and clinician level documents
    if (!["patient_only", "clinician"].includes(document.access_level)) {
      return res.status(403).json({
        error: "Access denied",
        message: "You do not have access to this document",
      })
    }

    // Get signed URL
    const result = await complianceService.getSignedDownloadUrl(
      id,
      patientId,
      "patient",
      expiresIn
    )

    res.json({
      download_url: result.url,
      expires_at: result.expires_at.toISOString(),
      document_id: id,
    })
  } catch (error) {
    console.error("Error generating patient download URL:", error)
    
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
