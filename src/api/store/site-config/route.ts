import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../../modules/business"

/**
 * GET /store/site-config
 * Public tenant runtime payload for static white-label templates.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)

  const business = (req as any).context?.business
  if (!business?.id) {
    return res.status(404).json({ message: "No tenant resolved for this request" })
  }

  const full = await businessService.retrieveBusiness(business.id)
  const template =
    (await businessService.getPublishedTemplate(full.id)) ||
    (await businessService.getLatestTemplateDraft(full.id))

  const categories = await businessService.listProductCategories(
    { business_id: full.id, is_active: true },
    { order: { rank: "ASC" } }
  )

  const { location, locationProducts } = await businessService.listCatalogProductsByBusiness(full.id)
  const activeRows = locationProducts.filter((row: any) => row.is_active !== false)

  const productIds = activeRows.map((row: any) => row.product_id)
  const products = productIds.length
    ? await productService.listProducts(
        { id: productIds },
        { relations: ["variants", "variants.prices"] }
      )
    : []
  const productMap = new Map(products.map((p: any) => [p.id, p]))

  const catalogProducts = activeRows.map((row: any) => {
    const base = productMap.get(row.product_id)
    return {
      ...base,
      product_id: row.product_id,
      location_product_id: row.id,
      category_id: row.category_id ?? null,
      custom_price: row.custom_price ?? null,
      rank: row.rank ?? 0,
      display_title: row.display_title ?? null,
      display_description: row.display_description ?? null,
      display_image_url: row.display_image_url ?? null,
      details_blocks: row.details_blocks ?? [],
      effective_title: row.display_title || base?.title || "",
      effective_description: row.display_description || base?.description || "",
      effective_image_url: row.display_image_url || base?.thumbnail || null,
    }
  })

  const groupedByCategory = categories.map((category: any) => ({
    category_id: category.id,
    category_name: category.name,
    products: catalogProducts.filter((p: any) => p.category_id === category.id),
  }))
  const uncategorized = catalogProducts.filter((p: any) => !p.category_id)
  if (uncategorized.length) {
    groupedByCategory.push({
      category_id: null,
      category_name: "Uncategorized",
      products: uncategorized,
    } as any)
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
    catalog: {
      location_id: location?.id || null,
      categories,
      products: catalogProducts,
      grouped_by_category: groupedByCategory,
    },
    publishable_api_key: full.settings?.publishable_api_key_token || null,
    sales_channel_id: full.sales_channel_id,
    generated_at: new Date().toISOString(),
  })
}
