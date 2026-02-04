/**
 * Store (Patient) Documents API Routes
 * 
 * GET /store/documents - List current patient's documents
 * POST /store/documents - Upload document (patient-uploaded files)
 * 
 * Returns only documents with access_level='patient_only' or 'clinician'
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../modules/compliance/service"
import { uploadSingleDocument, handleMulterError } from "../../middlewares/document-upload"

// Export config to disable body parsing for multipart uploads
export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * GET /store/documents
 * List documents accessible to the current patient
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )

    // Get current patient ID from customer context
    const patientId = (req as any).customer?.id
    
    if (!patientId) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please log in to view your documents",
      })
    }

    // Parse query parameters
    const query = req.query as Record<string, any>
    const filters = {
      patient_id: patientId, // Force patient filter
      consultation_id: query.consultation_id,
      order_id: query.order_id,
      type: query.type,
      date_from: query.date_from ? new Date(query.date_from) : undefined,
      date_to: query.date_to ? new Date(query.date_to) : undefined,
      skip: parseInt(query.offset) || 0,
      take: Math.min(parseInt(query.limit) || 20, 50),
    }

    // Remove undefined filters
    Object.keys(filters).forEach((key) => {
      if (filters[key] === undefined) delete filters[key]
    })

    // Get all patient's documents first
    const result = (await complianceService.listDocuments(filters)) as any

    // Filter to only include documents patient can access
    // Patient can access: patient_only and clinician level
    const accessibleDocuments = (result.documents as any[]).filter((doc: any) =>
      ["patient_only", "clinician"].includes(doc.access_level)
    )

    // Remove sensitive storage information from response
    const sanitizedDocuments = accessibleDocuments.map((doc: any) => ({
      id: doc.id,
      consultation_id: doc.consultation_id,
      order_id: doc.order_id,
      type: doc.type,
      title: doc.title,
      description: doc.description,
      file_name: doc.file_name,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      is_encrypted: doc.is_encrypted,
      download_count: doc.download_count,
      expires_at: doc.expires_at,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    }))

    res.json({
      documents: sanitizedDocuments,
      count: accessibleDocuments.length,
      limit: filters.take,
      offset: filters.skip,
    })
  } catch (error) {
    console.error("Error listing patient documents:", error)
    res.status(500).json({
      error: "Failed to list documents",
      message: error.message,
    })
  }
}

/**
 * POST /store/documents
 * Upload a document as a patient
 * 
 * Patients can upload documents like:
 * - ID verification
 * - Insurance cards
 * - Medical records
 * 
 * Documents are automatically set to 'patient_only' access level
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

      // Get current patient ID
      const patientId = (req as any).customer?.id
      
      if (!patientId) {
        return res.status(401).json({
          error: "Authentication required",
          message: "Please log in to upload documents",
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
      
      // Validate required fields
      const requiredFields = ["type", "title"]
      const missingFields = requiredFields.filter((field) => !body[field])
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          error: "Missing required fields",
          message: `Missing: ${missingFields.join(", ")}`,
        })
      }

      // Validate allowed document types for patients
      const allowedTypes = ["id_verification", "insurance_card", "medical_record", "consent_form", "other"]
      if (!allowedTypes.includes(body.type)) {
        return res.status(400).json({
          error: "Invalid document type",
          message: `Patients can only upload: ${allowedTypes.join(", ")}`,
        })
      }

      // Get business_id from context (set by tenant resolution middleware)
      const businessId = (req as any).tenantContext?.businessId
      
      if (!businessId) {
        return res.status(400).json({
          error: "Business context required",
          message: "No business context found",
        })
      }

      // Upload document - patients can only upload as 'patient_only' access level
      const document = (await complianceService.uploadDocument(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          business_id: businessId,
          patient_id: patientId,
          consultation_id: body.consultation_id || null,
          order_id: body.order_id || null,
          type: body.type,
          title: body.title,
          description: body.description || null,
          access_level: "patient_only", // Force patient_only for patient uploads
          expires_at: body.expires_at ? new Date(body.expires_at) : null,
        },
        patientId // Patient uploads their own document
      )) as any

      // Return sanitized document
      res.status(201).json({
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
      console.error("Error uploading patient document:", error)
      res.status(500).json({
        error: "Failed to upload document",
        message: error.message,
      })
    }
  })
}
