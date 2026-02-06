import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../../../../modules/business"

/**
 * GET /admin/businesses/:id/catalog
 * Returns tenant catalog configuration (categories + ordered product rows).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { id } = req.params
  const locationId = (req.query.location_id as string | undefined) || undefined

  await businessService.retrieveBusiness(id)

  const categories = await businessService.listProductCategories(
    { business_id: id },
    { order: { rank: "ASC" } }
  )

  const { location, locationProducts } = await businessService.listCatalogProductsByBusiness(id, locationId)

  if (!location) {
    return res.json({
      location: null,
      categories,
      products: [],
    })
  }

  const productIds = locationProducts.map((lp: any) => lp.product_id)
  const products = productIds.length
    ? await productService.listProducts(
        { id: productIds },
        { relations: ["variants", "variants.prices"] }
      )
    : []
  const productMap = new Map(products.map((p: any) => [p.id, p]))

  const rows = locationProducts.map((lp: any) => {
    const base = productMap.get(lp.product_id)
    return {
      ...base,
      product_id: lp.product_id,
      location_product_id: lp.id,
      category_id: lp.category_id,
      custom_price: lp.custom_price,
      is_active: lp.is_active,
      rank: lp.rank,
      display_title: lp.display_title ?? null,
      display_description: lp.display_description ?? null,
      display_image_url: lp.display_image_url ?? null,
      details_blocks: lp.details_blocks ?? [],
      effective_title: lp.display_title || base?.title || "",
      effective_description: lp.display_description || base?.description || "",
      effective_image_url: lp.display_image_url || base?.thumbnail || null,
    }
  })

  res.json({
    location,
    categories,
    products: rows,
  })
}
