/**
 * Admin Document Detail API Routes
 * 
 * GET /admin/documents/:id - Get document metadata
 * PUT /admin/documents/:id - Update document metadata
 * DELETE /admin/documents/:id - Delete document
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import ComplianceModuleService from "../../../../modules/compliance/service"
import { logAuditEvent } from "../../../middlewares/audit-logging"
import { 
  requireTenantContext, 
  createNotFoundResponse,
  logSecurityEvent,
  TenantContext 
} from "../../../../middlewares/tenant-isolation"

/**
 * GET /admin/documents/:id
 * Get document metadata with tenant isolation
 */
export const GET = [
  authenticate(),
  requireTenantContext(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    try {
      const complianceService: ComplianceModuleService = req.scope.resolve(
        "complianceModuleService"
      )

      const { id } = req.params
      const tenantContext = (req as any).tenant_context as TenantContext

      // Get document with access check
      const document = await complianceService.getDocumentById(id)
      
      // ENFORCE tenant isolation
      if (!document || document.business_id !== tenantContext.business_id) {
        if (document) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "document",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: document.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "document",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Document")
        return res.status(notFound.status).json(notFound.body)
      }

      // Return sanitized document
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
          last_downloaded_by: document.last_downloaded_by,
          expires_at: document.expires_at,
          created_at: document.created_at,
          updated_at: document.updated_at,
        },
      })
    } catch (error: any) {
      console.error("Error getting document:", error)
      
      if (error.message?.includes("not found")) {
        return res.status(404).json({
          error: "Document not found",
          message: error.message,
        })
      }

      res.status(500).json({
        error: "Failed to get document",
        message: error.message,
      })
    }
  },
]

/**
 * PUT /admin/documents/:id
 * Update document metadata with tenant isolation
 * 
 * Body:
 * - title: New title (optional)
 * - description: New description (optional)
 * - access_level: New access level (optional)
 */
export const PUT = [
  authenticate(),
  requireTenantContext(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    try {
      const complianceService: ComplianceModuleService = req.scope.resolve(
        "complianceModuleService"
      )

      const { id } = req.params
      const tenantContext = (req as any).tenant_context as TenantContext
      const body = req.body || {}

      // First retrieve to check tenant isolation
      const existingDocument = await complianceService.getDocumentById(id)
      
      // ENFORCE tenant isolation
      if (!existingDocument || existingDocument.business_id !== tenantContext.business_id) {
        if (existingDocument) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "document",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: existingDocument.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "document",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Document")
        return res.status(notFound.status).json(notFound.body)
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
      const userId = (req as any).auth_context?.actor_id || "unknown"
      const userType = (req as any).auth_context?.actor_type || "business_user"
      
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
          consultation_id: document.consultation_id,
          order_id: document.order_id,
          type: document.type,
          title: document.title,
          description: document.description,
          file_name: document.file_name,
          file_size: document.file_size,
          mime_type: document.mime_type,
          access_level: document.access_level,
          is_encrypted: document.is_encrypted,
          download_count: document.download_count,
          expires_at: document.expires_at,
          created_at: document.created_at,
          updated_at: document.updated_at,
        },
      })
    } catch (error: any) {
      console.error("Error updating document:", error)
      
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
  },
]

/**
 * DELETE /admin/documents/:id
 * Delete a document with tenant isolation
 */
export const DELETE = [
  authenticate(),
  requireTenantContext(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    try {
      const complianceService: ComplianceModuleService = req.scope.resolve(
        "complianceModuleService"
      )

      const { id } = req.params
      const tenantContext = (req as any).tenant_context as TenantContext

      // First retrieve to check tenant isolation
      const existingDocument = await complianceService.getDocumentById(id)
      
      // ENFORCE tenant isolation
      if (!existingDocument || existingDocument.business_id !== tenantContext.business_id) {
        if (existingDocument) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "document",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: existingDocument.business_id,
          })
        } else {
          await logSecurityEvent(req, "RESOURCE_ENUMERATION_ATTEMPT", {
            resource: "document",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
          })
        }
        
        const notFound = createNotFoundResponse("Document")
        return res.status(notFound.status).json(notFound.body)
      }

      const userId = (req as any).auth_context?.actor_id || "unknown"
      const userType = (req as any).auth_context?.actor_type || "business_user"

      // Delete document
      await complianceService.deleteDocument(id, userId, userType)

      res.status(204).send()
    } catch (error: any) {
      console.error("Error deleting document:", error)
      
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
  },
]
