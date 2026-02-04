import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../modules/consultation"

/**
 * GET /admin/tenant/consultations
 * List consultations for the tenant's business only
 */
export const GET = [
  authenticate("user", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const tenantContext = (req as any).tenant_context

    if (!tenantContext?.business_id) {
      return res.status(401).json({ message: "Not authenticated as tenant user" })
    }

    // Parse query parameters
    const {
      status,
      clinician_id,
      patient_id,
      date_from,
      date_to,
      mode,
      outcome,
      limit = "50",
      offset = "0",
    } = req.query as Record<string, string | undefined>

    // Build filters - always filter by tenant's business_id
    const filters: Record<string, any> = {
      business_id: tenantContext.business_id,
    }

    if (status) {
      filters.status = status
    }
    if (clinician_id) {
      filters.clinician_id = clinician_id
    }
    if (patient_id) {
      filters.patient_id = patient_id
    }
    if (mode) {
      filters.mode = mode
    }
    if (outcome) {
      filters.outcome = outcome
    }

    // Date range filtering on scheduled_at
    if (date_from || date_to) {
      filters.scheduled_at = {}
      if (date_from) {
        filters.scheduled_at.$gte = new Date(date_from)
      }
      if (date_to) {
        filters.scheduled_at.$lte = new Date(date_to)
      }
    }

    // Pagination
    const take = parseInt(limit, 10)
    const skip = parseInt(offset, 10)

    try {
      const [consultations, count] = await consultationService.listConsultations(
        filters,
        {
          skip,
          take,
          order: { created_at: "DESC" },
        }
      )

      res.json({
        consultations,
        count,
        limit: take,
        offset: skip,
        business_id: tenantContext.business_id,
      })
    } catch (error) {
      res.status(500).json({
        message: "Failed to list consultations",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

/**
 * POST /admin/tenant/consultations
 * Create a new consultation for the tenant's business
 */
export const POST = [
  authenticate("user", ["session", "bearer"]),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const tenantContext = (req as any).tenant_context

    if (!tenantContext?.business_id) {
      return res.status(401).json({ message: "Not authenticated as tenant user" })
    }

    try {
      // Automatically set the business_id from tenant context
      const body = (req.body ?? {}) as Record<string, any>
      const consultation = await consultationService.createConsultation({
        ...body,
        business_id: tenantContext.business_id,
      })

      res.status(201).json({ consultation })
    } catch (error) {
      res.status(400).json({
        message: "Failed to create consultation",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
