/**
 * Admin Document Download API Route
 * 
 * GET /admin/documents/:id/download
 *
 * In production (S3), this can return a signed URL.
 * In local development, this streams the file content directly so downloads work
 * without requiring static file hosting for the local upload directory.
 */

import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import ComplianceModuleService from "../../../../../modules/compliance/service"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"

/**
 * GET /admin/documents/:id/download
 * Download a document (stream) or generate a signed URL.
 * 
 * Query params:
 * - signed_url: "1" to return JSON with signed URL (default: stream)
 * - expires_in: URL expiration time in seconds (default: 300, max: 86400) (signed URL mode)
 * - disposition: "inline" | "attachment" (stream mode)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const complianceService: ComplianceModuleService = req.scope.resolve(
      "complianceModuleService"
    )
    const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any

    const { id } = req.params
    const authContext = (req as any).auth_context as
      | { actor_id?: string; actor_type?: string; business_id?: string; metadata?: any; app_metadata?: any }
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

    // Resolve clinician vs business staff
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

    const query = req.query as Record<string, any>
    const wantsSignedUrl = `${query.signed_url || ""}`.trim() === "1"

    // Fetch document metadata first for tenant + clinician checks.
    const document = await complianceService.getDocumentById(id)
    if (!document) {
      return res.status(404).json({
        error: "Document not found",
        message: `Document not found: ${id}`,
      })
    }

    if (tenantBusinessId && document.business_id !== tenantBusinessId) {
      return res.status(404).json({
        error: "Document not found",
        message: `Document not found: ${id}`,
      })
    }

    // PLAN access control: only the assigned clinician can view/download consultation documents.
    if (userType === "clinician") {
      if (!document.consultation_id) {
        return res.status(403).json({
          error: "Access denied",
          message: "Clinicians can only download documents linked to a consultation",
        })
      }

      const [consultations] = await consultationService.listAndCountConsultations(
        { id: document.consultation_id },
        { take: 1 }
      )
      const consultation = consultations?.[0]
      if (!consultation || !consultation.clinician_id || consultation.clinician_id !== clinicianId) {
        return res.status(403).json({
          error: "Access denied",
          message: "Only the assigned clinician can download consultation documents",
        })
      }
    }

    const complianceUserType = userType === "business_staff" ? "platform_admin" : "clinician"

    if (wantsSignedUrl) {
      // Parse expiration time (PLAN default: 5 minutes)
      const expiresIn = Math.min(parseInt(query.expires_in) || 300, 86400)

      const result = await complianceService.getSignedDownloadUrl(
        id,
        actorId,
        complianceUserType as any,
        expiresIn
      )

      return res.json({
        download_url: result.url,
        expires_at: result.expires_at.toISOString(),
        document_id: id,
      })
    }

    // Stream mode (local dev compatible)
    const dispositionRaw = typeof query.disposition === "string" ? query.disposition.trim() : ""
    const disposition =
      dispositionRaw === "attachment" || dispositionRaw === "inline"
        ? dispositionRaw
        : document.mime_type === "application/pdf"
          ? "inline"
          : "attachment"

    const content = await complianceService.downloadDocumentContent(
      id,
      actorId,
      complianceUserType as any
    )

    res.setHeader("Content-Type", content.document.mime_type || "application/octet-stream")
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename=\"${(content.document.file_name || "document").replace(/\"/g, "")}\"`
    )
    return res.status(200).send(content.buffer)
  } catch (error) {
    console.error("Error generating download URL:", error)
    
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
