/**
 * Store (Patient) Document Detail API Route
 * 
 * GET /store/documents/:id - Get document metadata (patient view)
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../modules/compliance/service"

/**
 * GET /store/documents/:id
 * Get document metadata for the current patient
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
        message: "Please log in to view documents",
      })
    }

    // Get document - patient can only access their own documents
    const document = await complianceService.getDocument(id, patientId, "patient")

    // Verify document belongs to patient and is accessible
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

    res.json({
      document: {
        id: document.id,
        consultation_id: document.consultation_id,
        order_id: document.order_id,
        type: document.type,
        title: document.title,
        description: document.description,
        file_name: document.file_name,
        file_size: document.file_size,
        mime_type: document.mime_type,
        is_encrypted: document.is_encrypted,
        download_count: document.download_count,
        expires_at: document.expires_at,
        created_at: document.created_at,
        updated_at: document.updated_at,
      },
    })
  } catch (error) {
    console.error("Error getting patient document:", error)
    
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
      error: "Failed to get document",
      message: error.message,
    })
  }
}
