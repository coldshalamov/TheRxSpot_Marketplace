/**
 * Tenant Document Detail API Routes
 * 
 * GET /admin/tenant/documents/:id - Get document metadata
 * PUT /admin/tenant/documents/:id - Update document metadata
 * DELETE /admin/tenant/documents/:id - Delete document
 * 
 * All routes are scoped to the tenant's business
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../../modules/compliance/service"

/**
 * GET /admin/tenant/documents/:id
 * Get document metadata for tenant's document
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    const { id } = req.params
    const businessId = (req as any).tenantContext?.businessId
    const userId = (req as any).auth_context?.actor_id || "unknown"
    const userType = (req as any).auth_context?.actor_type || "business_user"

    if (!businessId) {
      return res.status(400).json({
        error: "Tenant context required",
        message: "No business ID found in tenant context",
      })
    }

    // Get document
    const document = await complianceService.getDocument(id, userId, userType)

    // Verify document belongs to tenant's business
    if (document.business_id !== businessId) {
      return res.status(403).json({
        error: "Access denied",
        message: "Document does not belong to this business",
      })
    }

    res.json({
      document: {
        id: document.id,
        business_id: document.business_id,
        patient_id: document.patient_id,
        consultation_id: document.consultation_id,
        order_id: document.order_id,
        uploaded_by: document.uploaded_by,
        type: document.type,
        title: document.title,
        description: document.description,
        file_name: document.file_name,
        file_size: document.file_size,
        mime_type: document.mime_type,
        access_level: document.access_level,
        is_encrypted: document.is_encrypted,
        download_count: document.download_count,
        last_downloaded_at: document.last_downloaded_at,
        expires_at: document.expires_at,
        created_at: document.created_at,
        updated_at: document.updated_at,
      },
    })
  } catch (error) {
    console.error("Error getting tenant document:", error)
    
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

/**
 * PUT /admin/tenant/documents/:id
 * Update document metadata
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    const { id } = req.params
    const businessId = (req as any).tenantContext?.businessId
    const userId = (req as any).auth_context?.actor_id || "unknown"
    const userType = (req as any).auth_context?.actor_type || "business_user"
    const body = req.body || {}

    if (!businessId) {
      return res.status(400).json({
        error: "Tenant context required",
        message: "No business ID found in tenant context",
      })
    }

    // First get the document to verify ownership
    const existingDoc = await complianceService.getDocument(id, userId, userType)
    
    if (existingDoc.business_id !== businessId) {
      return res.status(403).json({
        error: "Access denied",
        message: "Document does not belong to this business",
      })
    }

    // Validate input
    const allowedUpdates = ["title", "description", "access_level"]
    const updates: Partial<typeof body> = {}
    
    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "No valid fields to update",
        message: "Provide at least one of: title, description, access_level",
      })
    }

    // Update document
    const document = await complianceService.updateDocumentMetadata(
      id,
      updates,
      userId,
      userType
    )

    res.json({
      document: {
        id: document.id,
        business_id: document.business_id,
        patient_id: document.patient_id,
        type: document.type,
        title: document.title,
        description: document.description,
        file_name: document.file_name,
        file_size: document.file_size,
        mime_type: document.mime_type,
        access_level: document.access_level,
        expires_at: document.expires_at,
        created_at: document.created_at,
        updated_at: document.updated_at,
      },
    })
  } catch (error) {
    console.error("Error updating tenant document:", error)
    
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
      error: "Failed to update document",
      message: error.message,
    })
  }
}

/**
 * DELETE /admin/tenant/documents/:id
 * Delete a document
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    const { id } = req.params
    const businessId = (req as any).tenantContext?.businessId
    const userId = (req as any).auth_context?.actor_id || "unknown"
    const userType = (req as any).auth_context?.actor_type || "business_user"

    if (!businessId) {
      return res.status(400).json({
        error: "Tenant context required",
        message: "No business ID found in tenant context",
      })
    }

    // First get the document to verify ownership
    const existingDoc = await complianceService.getDocument(id, userId, userType)
    
    if (existingDoc.business_id !== businessId) {
      return res.status(403).json({
        error: "Access denied",
        message: "Document does not belong to this business",
      })
    }

    // Delete document
    await complianceService.deleteDocument(id, userId, userType)

    res.status(204).send()
  } catch (error) {
    console.error("Error deleting tenant document:", error)
    
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
      error: "Failed to delete document",
      message: error.message,
    })
  }
}
