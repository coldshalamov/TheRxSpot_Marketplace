import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework"
import { CONSULTATION_MODULE } from "../../../../modules/consultation"

/**
 * GET /admin/tenant/clinicians
 * List clinicians for the tenant's business
 */
export const GET = [
  authenticate(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const tenantContext = (req as any).tenant_context

    if (!tenantContext?.business_id) {
      return res.status(401).json({ message: "Not authenticated as tenant user" })
    }

    // Parse query parameters
    const {
      status,
      specialization,
      include_platform,
      limit = "50",
      offset = "0",
    } = req.query as Record<string, string | undefined>

    // Build filters
    const filters: Record<string, any> = {
      business_id: tenantContext.business_id,
    }

    if (status) {
      filters.status = status
    }

    // Specialization filter - search in specializations array
    if (specialization) {
      filters.specializations = { $contains: specialization }
    }

    // Pagination
    const take = parseInt(limit, 10)
    const skip = parseInt(offset, 10)

    try {
      // Get business clinicians
      const [clinicians, count] = await consultationService.listClinicians(
        filters,
        {
          skip,
          take,
          order: { created_at: "DESC" },
        }
      )

      // Optionally include platform clinicians
      let allClinicians = clinicians
      let platformClinicians: any[] = []

      if (include_platform === "true") {
        platformClinicians = await consultationService.getPlatformClinicians()
        allClinicians = [...clinicians, ...platformClinicians]
      }

      res.json({
        clinicians: allClinicians,
        count: include_platform === "true" ? allClinicians.length : count,
        platform_clinicians_count: platformClinicians.length,
        limit: take,
        offset: skip,
        business_id: tenantContext.business_id,
      })
    } catch (error) {
      res.status(500).json({
        message: "Failed to list clinicians",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]

/**
 * POST /admin/tenant/clinicians
 * Create a new clinician for the tenant's business
 */
export const POST = [
  authenticate(),
  async (req: MedusaRequest, res: MedusaResponse) => {
    const consultationService = req.scope.resolve(CONSULTATION_MODULE)
    const tenantContext = (req as any).tenant_context

    if (!tenantContext?.business_id) {
      return res.status(401).json({ message: "Not authenticated as tenant user" })
    }

    try {
      // Automatically set the business_id from tenant context
      // and ensure is_platform_clinician is false
      const clinician = await consultationService.createClinician({
        ...req.body,
        business_id: tenantContext.business_id,
        is_platform_clinician: false,
      })

      res.status(201).json({ clinician })
    } catch (error) {
      res.status(400).json({
        message: "Failed to create clinician",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
]
