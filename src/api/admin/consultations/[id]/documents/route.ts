/**
 * Admin Consultation Document Upload (PLAN)
 *
 * POST /admin/consultations/:id/documents
 *
 * Accepts multipart/form-data with:
 * - document: file (PDF/JPG/PNG, max 10MB)
 * - type: document type
 * - title: document title
 * - description?: optional
 * - access_level: patient_only | clinician | business_staff | platform_admin
 * - expires_at?: ISO date string
 *
 * Access control:
 * - Admin/business staff can upload for any consultation in their business.
 * - Clinicians can upload only for consultations they are assigned to.
 *
 * Storage:
 * - Uses the compliance module storage provider (local in dev, S3 in prod).
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"
import ComplianceModuleService from "../../../../../modules/compliance/service"
import {
  uploadSingleDocument,
  handleMulterError,
  virusScanMiddleware,
} from "../../../../middlewares/document-upload"
import { isValidAccessLevel } from "../../../../../modules/compliance/utils/access-control"

export const config = {
  api: {
    bodyParser: false,
  },
}

type UserType = "clinician" | "business_staff"

function getOptionalTenantBusinessId(req: MedusaRequest): string | undefined {
  const authContext = (req as any).auth_context as
    | {
        business_id?: string
        metadata?: Record<string, any>
        app_metadata?: Record<string, any>
      }
    | undefined

  return (
    authContext?.business_id ||
    authContext?.metadata?.business_id ||
    authContext?.app_metadata?.business_id ||
    (req as any)?.tenant_context?.business_id
  )
}

async function resolveUserType(
  req: MedusaRequest,
  consultationService: any
): Promise<{ actorId: string | null; userType: UserType; clinicianId: string | null }> {
  const authContext = (req as any).auth_context as
    | { actor_id?: string; actor_type?: string }
    | undefined

  const actorId = authContext?.actor_id || null
  const rawActorType = authContext?.actor_type || "user"

  if (!actorId) {
    return { actorId: null, userType: "business_staff", clinicianId: null }
  }

  // If the auth system explicitly marks clinicians, prefer it.
  if (rawActorType === "clinician") {
    return { actorId, userType: "clinician", clinicianId: actorId }
  }

  // In this repo, clinicians can be represented as admin `user` actors with a clinician record linked by `user_id`.
  try {
    const [clinicians] = await consultationService.listAndCountClinicians(
      { user_id: actorId },
      { take: 1 }
    )
    const clinician = clinicians?.[0]
    if (clinician?.id) {
      return { actorId, userType: "clinician", clinicianId: clinician.id as string }
    }
  } catch {
    // Ignore lookup errors and treat as business staff.
  }

  return { actorId, userType: "business_staff", clinicianId: null }
}

function validateDocumentType(type: string): boolean {
  return [
    "prescription",
    "lab_result",
    "medical_record",
    "consent_form",
    "id_verification",
    "insurance_card",
    "other",
  ].includes(type)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  uploadSingleDocument(req as any, res as any, async (err: any) => {
    if (err) {
      return handleMulterError(err, req, res, () => {})
    }

    // Virus scan / content validation
    await virusScanMiddleware(req as any, res as any, async () => {
      const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
      const complianceService: ComplianceModuleService = req.scope.resolve(
        "complianceModuleService"
      )

      const actor = await resolveUserType(req, consultationService)
      if (!actor.actorId) {
        return res.status(401).json({
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        })
      }

      const { id: consultationId } = req.params

      let consultation: any
      try {
        const [consultations] = await consultationService.listAndCountConsultations(
          { id: consultationId },
          { take: 1 }
        )
        consultation = consultations?.[0]
      } catch {
        consultation = null
      }

      if (!consultation) {
        return res.status(404).json({
          code: "NOT_FOUND",
          message: "Consultation not found",
        })
      }

      const tenantBusinessId = getOptionalTenantBusinessId(req)
      if (tenantBusinessId && consultation.business_id !== tenantBusinessId) {
        return res.status(404).json({
          code: "NOT_FOUND",
          message: "Consultation not found",
        })
      }

      if (actor.userType === "clinician") {
        if (!consultation.clinician_id || consultation.clinician_id !== actor.clinicianId) {
          return res.status(403).json({
            code: "FORBIDDEN",
            message: "Only the assigned clinician can upload documents for this consultation",
          })
        }
      }

      const file = (req as any).file as
        | { buffer: Buffer; originalname: string; mimetype: string; size: number }
        | undefined

      if (!file) {
        return res.status(400).json({
          code: "INVALID_INPUT",
          message: "Please provide a file in the 'document' field",
        })
      }

      const body = (req.body ?? {}) as Record<string, any>
      const type = typeof body.type === "string" ? body.type.trim() : ""
      const title = typeof body.title === "string" ? body.title.trim() : ""
      const description = typeof body.description === "string" ? body.description.trim() : null
      const accessLevel = typeof body.access_level === "string" ? body.access_level.trim() : ""
      const expiresAtRaw = typeof body.expires_at === "string" ? body.expires_at.trim() : ""

      if (!type || !validateDocumentType(type)) {
        return res.status(400).json({
          code: "INVALID_INPUT",
          message:
            "type must be one of: prescription, lab_result, medical_record, consent_form, id_verification, insurance_card, other",
        })
      }

      if (!title) {
        return res.status(400).json({
          code: "INVALID_INPUT",
          message: "title is required",
        })
      }

      if (!accessLevel || !isValidAccessLevel(accessLevel)) {
        return res.status(400).json({
          code: "INVALID_INPUT",
          message:
            "access_level must be one of: patient_only, clinician, business_staff, platform_admin",
        })
      }

      let expiresAt: Date | null = null
      if (expiresAtRaw) {
        const parsed = new Date(expiresAtRaw)
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({
            code: "INVALID_INPUT",
            message: "expires_at must be a valid ISO date string",
          })
        }
        expiresAt = parsed
      }

      const timestamp = Date.now()
      const safeOriginalName = `${file.originalname || "document"}`
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_{2,}/g, "_")
      const uniqueOriginalName = `${consultationId}_${timestamp}_${safeOriginalName}`

      try {
        const document = (await complianceService.uploadDocument(
          {
            buffer: file.buffer,
            originalname: uniqueOriginalName,
            mimetype: file.mimetype,
            size: file.size,
          },
          {
            business_id: consultation.business_id,
            patient_id: consultation.patient_id,
            consultation_id: consultationId,
            type: type as any,
            title,
            description,
            access_level: accessLevel as any,
            expires_at: expiresAt,
          },
          actor.actorId,
          actor.userType === "clinician" ? "clinician" : "business_user"
        )) as any

        return res.status(201).json({
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
        return res.status(400).json({
          code: "UPLOAD_FAILED",
          message: "Failed to upload document",
          error: error?.message || "Unknown error",
        })
      }
    })
  })
}

