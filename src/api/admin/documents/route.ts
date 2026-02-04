/**
 * Admin Documents API Routes
 * 
 * GET /admin/documents - List documents with filters
 * POST /admin/documents - Upload new document
 * 
 * HIPAA-008 SECURITY NOTICE:
 * The GET endpoint may expose PHI (patient_id, consultation_id) in URL query parameters.
 * For searches involving PHI, use POST /admin/documents/search instead.
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../modules/compliance/service"
import { CONSULTATION_MODULE } from "../../../modules/consultation"
import { uploadSingleDocument, handleMulterError, virusScanMiddleware } from "../../middlewares/document-upload"
import { logAuditEvent } from "../../middlewares/audit-logging"

// Export config to disable body parsing for multipart uploads
export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * GET /admin/documents
 * List documents with filters and pagination
 * 
 * ⚠️ DEPRECATION WARNING:
 * For searches involving PHI identifiers (patient_id, consultation_id), 
 * use POST /admin/documents/search instead to prevent PHI exposure in URLs.
 * 
 * Query params (for non-PHI filters only):
 * - business_id: Filter by business
 * - order_id: Filter by order
 * - type: Filter by document type
 * - access_level: Filter by access level
 * - date_from: Filter by date range start
 * - date_to: Filter by date range end
 * - limit: Number of results (default: 20, max: 100)
 * - offset: Pagination offset (default: 0)
 * 
 * PHI filters (patient_id, consultation_id) should use POST /admin/documents/search
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )
    const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any

    const authContext = (req as any).auth_context as
      | {
          actor_id?: string
          actor_type?: string
          business_id?: string
          metadata?: Record<string, any>
          app_metadata?: Record<string, any>
        }
      | undefined

    const actorId = authContext?.actor_id || null
    if (!actorId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      })
    }

    const tenantBusinessId =
      authContext?.business_id ||
      authContext?.metadata?.business_id ||
      authContext?.app_metadata?.business_id ||
      (req as any)?.tenant_context?.business_id

    // Resolve "business_staff" vs "clinician" for access control.
    // Clinicians can be represented as admin `user` actors with a clinician record linked by `user_id`.
    let userType: "business_staff" | "clinician" = "business_staff"
    let clinicianId: string | null = null

    if (authContext?.actor_type === "clinician") {
      userType = "clinician"
      clinicianId = actorId
    } else {
      try {
        const [clinicians] = await consultationService.listAndCountClinicians(
          { user_id: actorId },
          { take: 1 }
        )
        const clinician = clinicians?.[0]
        if (clinician?.id) {
          userType = "clinician"
          clinicianId = clinician.id as string
        }
      } catch {
        // Ignore lookup errors and treat as business staff.
      }
    }

    // Parse query parameters
    const query = req.query as Record<string, any>
    
    // HIPAA-008: Warn if PHI is detected in query params
    if (query.patient_id || query.consultation_id) {
      // Log security warning
      console.warn("[HIPAA-008] PHI detected in URL query params. Use POST /admin/documents/search instead.")
      
      // Log audit event for potential security issue
      try {
        await logAuditEvent(req, {
          action: "read",
          entityType: "document",
          entityId: "search",
          metadata: {
            warning: "PHI_EXPOSURE_IN_URL",
            message: "patient_id or consultation_id was passed in URL query params",
            recommendation: "Use POST /admin/documents/search for PHI filters",
          },
          riskLevel: "medium",
        })
      } catch {
        // Ignore logging errors
      }
    }
    
    // Access control + tenant scoping:
    // - Clinicians can only list documents for a consultation they are assigned to.
    // - Business staff can list documents for their business (or explicit business_id if no tenant info).
    const consultationId = typeof query.consultation_id === "string" ? query.consultation_id.trim() : ""

    let resolvedBusinessId = tenantBusinessId || (typeof query.business_id === "string" ? query.business_id.trim() : "")

    if (consultationId) {
      const [consultations] = await consultationService.listAndCountConsultations(
        { id: consultationId },
        { take: 1 }
      )
      const consultation = consultations?.[0]
      if (!consultation) {
        return res.status(404).json({
          error: "Consultation not found",
          message: "Consultation not found",
          code: "NOT_FOUND",
        })
      }

      if (tenantBusinessId && consultation.business_id !== tenantBusinessId) {
        return res.status(404).json({
          error: "Consultation not found",
          message: "Consultation not found",
          code: "NOT_FOUND",
        })
      }

      if (userType === "clinician") {
        if (!consultation.clinician_id || consultation.clinician_id !== clinicianId) {
          return res.status(403).json({
            error: "Access denied",
            message: "Only the assigned clinician can view consultation documents",
            code: "FORBIDDEN",
          })
        }
      }

      resolvedBusinessId = consultation.business_id
    } else if (userType === "clinician") {
      return res.status(400).json({
        error: "Missing required filters",
        message: "consultation_id is required for clinician document listing",
        code: "INVALID_INPUT",
      })
    }

    if (!resolvedBusinessId) {
      return res.status(400).json({
        error: "Missing required filters",
        message: "business_id is required",
        code: "INVALID_INPUT",
      })
    }

    const filters = {
      business_id: resolvedBusinessId,
      // HIPAA-008: These should ideally be moved to POST /admin/documents/search
      // But we support them here for backwards compatibility with security warning
      patient_id: query.patient_id,
      consultation_id: consultationId || undefined,
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
        ? "PHI filters in URLs are deprecated. Use POST /admin/documents/search for PHI queries."
        : undefined,
    })
  } catch (error) {
    console.error("Error listing documents:", error)
    res.status(500).json({
      error: "Failed to list documents",
      message: error.message,
    })
  }
}

/**
 * POST /admin/documents
 * Upload a new document
 * 
 * Form data:
 * - document: File to upload (required)
 * - business_id: Business ID (required)
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
      
      // Validate required fields
      const requiredFields = ["business_id", "patient_id", "type", "title", "access_level"]
      const missingFields = requiredFields.filter((field) => !body[field])
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          error: "Missing required fields",
          message: `Missing: ${missingFields.join(", ")}`,
        })
      }

      // Get current user ID from auth context
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
          business_id: body.business_id,
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

      // Return sanitized document (without storage keys)
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
      console.error("Error uploading document:", error)
      res.status(500).json({
        error: "Failed to upload document",
        message: error.message,
      })
    }
  })
}
