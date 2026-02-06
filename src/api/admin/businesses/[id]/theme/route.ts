import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../modules/business"

/**
 * GET /admin/businesses/:id/theme
 * Returns the published template config (or latest draft) for a business.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params

  // Verify business exists
  await businessService.retrieveBusiness(id)

  const published = await businessService.getPublishedTemplate(id)

  if (!published) {
    // Auto-create default template on first access
    const created = await businessService.createDefaultTemplate(id)
    return res.json({ template: created })
  }

  res.json({ template: published })
}

/**
 * PUT /admin/businesses/:id/theme
 * Update the template configuration for a business.
 * Creates a new draft version; optionally publishes immediately.
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  const body = (req.body ?? {}) as Record<string, any>

  // Verify business exists
  await businessService.retrieveBusiness(id)

  const { publish, ...templateData } = body

  // Get current latest version to increment
  const latest = await businessService.getLatestTemplateDraft(id)
  const nextVersion = latest ? (latest.version || 0) + 1 : 1

  // If updating an existing draft (not yet published), update in-place
  if (latest && !latest.is_published && !publish) {
    const updated = await businessService.updateTemplateConfigs({
      id: latest.id,
      ...templateData,
    } as any)
    return res.json({ template: updated })
  }

  // Create new version
  const template = await businessService.createTemplateConfigs({
    business_id: id,
    template_id: templateData.template_id || latest?.template_id || "default",
    version: nextVersion,
    is_published: false,
    sections: templateData.sections || latest?.sections || [],
    global_styles: templateData.global_styles || latest?.global_styles || {},
    metadata: templateData.metadata || {},
  } as any)

  // Publish if requested
  if (publish) {
    const authContext = (req as any).auth_context
    const publishedBy = authContext?.actor_id || "admin"
    const published = await businessService.publishTemplate(template.id, publishedBy)
    return res.json({ template: published })
  }

  res.json({ template })
}
