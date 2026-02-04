import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = (req as any).tenant_context
  if (!tenantContext) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const business = await businessModuleService.retrieveBusiness(
    tenantContext.business_id
  )

  res.json({
    branding: {
      primary_color: business.primary_color,
      secondary_color: business.secondary_color,
      logo_url: business.logo_url,
      ...((business.branding_config as object) || {}),
    },
  })
}

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = (req as any).tenant_context
  if (!tenantContext) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { primary_color, secondary_color, logo_url, ...brandingExtras } =
    req.body as Record<string, any>

  const updateData: Record<string, any> = {}
  if (primary_color !== undefined) updateData.primary_color = primary_color
  if (secondary_color !== undefined) updateData.secondary_color = secondary_color
  if (logo_url !== undefined) updateData.logo_url = logo_url
  if (Object.keys(brandingExtras).length) {
    const business = await businessModuleService.retrieveBusiness(
      tenantContext.business_id
    )
    updateData.branding_config = {
      ...((business.branding_config as object) || {}),
      ...brandingExtras,
    }
  }

  const [updated] = await businessModuleService.updateBusinesses({
    selector: { id: tenantContext.business_id },
    data: updateData,
  })

  res.json({
    branding: {
      primary_color: updated.primary_color,
      secondary_color: updated.secondary_color,
      logo_url: updated.logo_url,
      ...((updated.branding_config as object) || {}),
    },
  })
}
