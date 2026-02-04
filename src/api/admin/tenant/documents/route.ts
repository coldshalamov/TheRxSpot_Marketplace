/**
 * Tenant Documents API Routes
 * 
 * GET /admin/tenant/documents - List documents for tenant's business
 * POST /admin/tenant/documents - Upload document for tenant
 * 
 * These routes automatically filter by the tenant's business_id
 * 
 * HIPAA-008 SECURITY NOTICE:
 * The GET endpoint may expose PHI (patient_id, consultation_id) in URL query parameters.
 * For searches involving PHI, use POST /admin/tenant/documents/search instead.
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../modules/compliance/service"
import { uploadSingleDocument, handleMulterError } from "../../../middlewares/document-upload"
import { logAuditEvent } from "../../../middlewares/audit-logging"

// Export config to disable body parsing for multipart uploads
export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * GET /admin/tenant/documents
 * List documents for the current tenant's business
 * 
 * ⚠️ DEPRECATION WARNING:
 * For searches involving PHI identifiers (patient_id, consultation_id), 
 * use POST /admin/tenant/documents/search instead to prevent PHI exposure in URLs.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    // Get tenant's business ID from context
    const businessId = (req as any).tenantContext?.businessId
    
    if (!businessId) {
      return res.status(400).json({
        error: "Tenant context required",
        message: "No business ID found in tenant context",
      })
    }

    // Parse query parameters
    const query = req.query as Record<string, any>
    
    // HIPAA-008: Warn if PHI is detected in query params
    if (query.patient_id || query.consultation_id) {
      console.warn("[HIPAA-008] PHI detected in URL query params. Use POST /admin/tenant/documents/search instead.")
      
      try {
        await logAuditEvent(req, {
          action: "read",
          entityType: "document",
          entityId: "search",
          metadata: {
            warning: "PHI_EXPOSURE_IN_URL",
            message: "patient_id or consultation_id was passed in URL query params",
            recommendation: "Use POST /admin/tenant/documents/search for PHI filters",
          },
          riskLevel: "medium",
        })
      } catch {
        // Ignore logging errors
      }
    }

    const filters = {
      business_id: businessId, // Force business filter
      // HIPAA-008: These should ideally be moved to POST /admin/tenant/documents/search
      patient_id: query.patient_id,
      consultation_id: query.consultation_id,
      order_id: query.order_id,
      type: query.type,
      access_level: query.access_level,
      date_from: query.date_from ? new Date(query.date_from) : undefined,
      date_to: query.date_to ? new Date(query.date_to) : undefined,
      skip: parseInt(query.offset) || 0,
      take: Math.min(parseInt(query.limit) || 20, 100),
    }

    // Remove undefined filters
    Object.keys(filters).forEach((key) => {
      if (filters[key] === undefined) delete filters[key]
    })

    const result = (await complianceService.listDocuments(filters)) as any

    // Remove sensitive storage information from response
    const sanitizedDocuments = (result.documents as any[]).map((doc: any) => ({
      id: doc.id,
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
      last_downloaded_at: doc.last_downloaded_at,
      expires_at: doc.expires_at,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    }))

    res.json({
      documents: sanitizedDocuments,
      count: result.count,
      limit: filters.take,
      offset: filters.skip,
      // Add deprecation notice to response
      _security_notice: (query.patient_id || query.consultation_id) 
        ? "PHI filters in URLs are deprecated. Use POST /admin/tenant/documents/search for PHI queries."
        : undefined,
    })
  } catch (error) {
    console.error("Error listing tenant documents:", error)
    res.status(500).json({
      error: "Failed to list documents",
      message: error.message,
    })
  }
}

/**
 * POST /admin/tenant/documents
 * Upload a document for the tenant's business
 * 
 * Form data:
 * - document: File to upload (required)
 * - patient_id: Patient ID (required) - PHI, passed in body (secure)
 * - consultation_id: Consultation ID (optional) - PHI, passed in body (secure)
 * - order_id: Order ID (optional)
 * - type: Document type (required)
 * - title: Document title (required)
 * - description: Document description (optional)
 * - access_level: Access level (required)
 * - expires_at: Expiration date (optional)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Use multer middleware
  uploadSingleDocument(req as any, res as any, async (err: any) => {
    if (err) {
      return handleMulterError(err, req, res, () => {})
    }

    try {
      const complianceService: ComplianceModuleService = req.scope.resolve(
        "complianceModuleService"
      )

      // Get tenant's business ID
      const businessId = (req as any).tenantContext?.businessId
      
      if (!businessId) {
        return res.status(400).json({
          error: "Tenant context required",
          message: "No business ID found in tenant context",
        })
      }

      // Get uploaded file
      const file = (req as any).file
      if (!file) {
        return res.status(400).json({
          error: "No file uploaded",
          message: "Please provide a file in the 'document' field",
        })
      }

      // Parse metadata from request body
      const body = (req.body ?? {}) as Record<string, any>
      
      // Validate required fields (business_id is auto-set from tenant)
      const requiredFields = ["patient_id", "type", "title", "access_level"]
      const missingFields = requiredFields.filter((field) => !body[field])
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          error: "Missing required fields",
          message: `Missing: ${missingFields.join(", ")}`,
        })
      }

      // Get current user ID
      const uploadedBy = (req as any).auth_context?.actor_id || "unknown"

      // Upload document
      const document = (await complianceService.uploadDocument(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          business_id: businessId, // Auto-set from tenant context
          patient_id: body.patient_id,         // PHI - in body (secure)
          consultation_id: body.consultation_id || null, // PHI - in body (secure)
          order_id: body.order_id || null,
          type: body.type,
          title: body.title,
          description: body.description || null,
          access_level: body.access_level,
          expires_at: body.expires_at ? new Date(body.expires_at) : null,
        },
        uploadedBy
      )) as any

      // Return sanitized document
      res.status(201).json({
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
    } catch (error) {
      console.error("Error uploading tenant document:", error)
      res.status(500).json({
        error: "Failed to upload document",
        message: error.message,
      })
    }
  })
}
