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
import ComplianceModuleService from "../../../../modules/compliance/service"
import { logAuditEvent } from "../../../middlewares/audit-logging"
import { getLogger } from "../../../../utils/logger"

const logger = getLogger()
import { 
  ensureTenantContext,
  createNotFoundResponse,
  logSecurityEvent,
  TenantContext 
} from "../../../middlewares/tenant-isolation"

/**
 * GET /admin/documents/:id
 * Get document metadata with tenant isolation
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    try {
      const complianceService: ComplianceModuleService = req.scope.resolve(
        "complianceModuleService"
      )

      const { id } = req.params
      const tenantContext = ensureTenantContext(req, res) as TenantContext | null
      if (!tenantContext) {
        return
      }

      // Get document with access check
      const doc = (await complianceService.getDocumentById(id)) as any
      
      // ENFORCE tenant isolation
      if (!doc || doc.business_id !== tenantContext.business_id) {
        if (doc) {
          await logSecurityEvent(req, "CROSS_TENANT_ACCESS_ATTEMPT", {
            resource: "document",
            resource_id: id,
            attempted_by_business: tenantContext.business_id,
            target_business_id: doc.business_id,
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
          id: doc.id,
          business_id: doc.business_id,
          patient_id: doc.patient_id,
          consultation_id: doc.consultation_id,
          order_id: doc.order_id,
          uploaded_by: doc.uploaded_by,
          type: doc.type,
          title: doc.title,
          description: doc.description,
          file_name: doc.file_name,
          file_size: doc.file_size,
          mime_type: doc.mime_type,
          access_level: doc.access_level,
          is_encrypted: doc.is_encrypted,
          download_count: doc.download_count,
          last_downloaded_at: doc.last_downloaded_at,
          last_downloaded_by: doc.last_downloaded_by,
          expires_at: doc.expires_at,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
        },
      })
    } catch (error: any) {
      logger.error({ error }, "admin-documents: failed to get document")
      
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
}

/**
 * PUT /admin/documents/:id
 * Update document metadata with tenant isolation
 * 
 * Body:
 * - title: New title (optional)
 * - description: New description (optional)
 * - access_level: New access level (optional)
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
    try {
      const complianceService: ComplianceModuleService = req.scope.resolve(
        "complianceModuleService"
      )

      const { id } = req.params
      const tenantContext = ensureTenantContext(req, res) as TenantContext | null
      if (!tenantContext) {
        return
      }
      const body = req.body || {}

      // First retrieve to check tenant isolation
      const existingDocument = (await complianceService.getDocumentById(id)) as any
      
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
      
      const doc = (await complianceService.updateDocumentMetadata(
        id,
        updates,
        userId,
        userType
      )) as any

      res.json({
        document: {
          id: doc.id,
          business_id: doc.business_id,
          patient_id: doc.patient_id,
          consultation_id: doc.consultation_id,
          order_id: doc.order_id,
          type: doc.type,
          title: doc.title,
          description: doc.description,
          file_name: doc.file_name,
          file_size: doc.file_size,
          mime_type: doc.mime_type,
          access_level: doc.access_level,
          is_encrypted: doc.is_encrypted,
          download_count: doc.download_count,
          expires_at: doc.expires_at,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
        },
      })
    } catch (error: any) {
      logger.error({ error }, "admin-documents: failed to update document")
      
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
 * DELETE /admin/documents/:id
 * Delete a document with tenant isolation
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    try {
      const complianceService: ComplianceModuleService = req.scope.resolve(
        "complianceModuleService"
      )

      const { id } = req.params
      const tenantContext = ensureTenantContext(req, res) as TenantContext | null
      if (!tenantContext) {
        return
      }

      // First retrieve to check tenant isolation
      const existingDocument = (await complianceService.getDocumentById(id)) as any
      
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
      await complianceService.removeDocument(id, userId, userType)

      res.status(204).send()
    } catch (error: any) {
      logger.error({ error }, "admin-documents: failed to delete document")
      
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
