import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const business = (req as any).context?.business

  if (!business) {
    return res.status(404).json({ message: "No tenant resolved for this request" })
  }

  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const full = await businessService.retrieveBusiness(business.id)

  // Fetch the published template config for this tenant
  let template = null
  try {
    template = await businessService.getPublishedTemplate(business.id)
  } catch {
    // Template system not yet provisioned for this tenant - that's okay
  }

  res.json({
    business: {
      id: full.id,
      name: full.name,
      slug: full.slug,
      logo_url: full.logo_url,
      domain: full.domain,
      status: full.status,
    },
    branding: {
      primary_color: full.primary_color,
      secondary_color: full.secondary_color,
      ...(full.branding_config as object),
    },
    template: template
      ? {
          template_id: template.template_id,
          version: template.version,
          sections: template.sections,
          global_styles: template.global_styles,
          metadata: template.metadata,
        }
      : null,
    catalog_config: full.catalog_config,
    publishable_api_key: full.settings?.publishable_api_key_token || null,
    sales_channel_id: full.sales_channel_id,
  })
}
