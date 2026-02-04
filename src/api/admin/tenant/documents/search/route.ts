/**
 * Secure Tenant Document Search API Route
 * 
 * POST /admin/tenant/documents/search
 * 
 * HIPAA-008 FIX: Moved from GET with query params to POST with body
 * Prevents patient_id and other PHI from appearing in URLs
 * 
 * These routes automatically filter by the tenant's business_id
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../../modules/compliance/service"

/**
 * POST /admin/tenant/documents/search
 * Search documents for the current tenant's business
 * 
 * Request body:
 * - patient_id: Filter by patient (PHI - moved from query to body)
 * - consultation_id: Filter by consultation (PHI - moved from query to body)
 * - order_id: Filter by order
 * - type: Filter by document type
 * - access_level: Filter by access level
 * - date_from: Filter by date range start
 * - date_to: Filter by date range end
 * - limit: Number of results (default: 20, max: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
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

    // Parse filters from request body (not query params)
    const body = (req.body ?? {}) as Record<string, any>
    const filters = {
      business_id: businessId, // Force business filter
      patient_id: body.patient_id,       // PHI - now in body, not URL
      consultation_id: body.consultation_id, // PHI - now in body, not URL
      order_id: body.order_id,
      type: body.type,
      access_level: body.access_level,
      date_from: body.date_from ? new Date(body.date_from) : undefined,
      date_to: body.date_to ? new Date(body.date_to) : undefined,
      skip: parseInt(body.offset) || 0,
      take: Math.min(parseInt(body.limit) || 20, 100),
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
    })
  } catch (error) {
    console.error("Error searching tenant documents:", error)
    res.status(500).json({
      error: "Failed to search documents",
      message: error.message,
    })
  }
}
