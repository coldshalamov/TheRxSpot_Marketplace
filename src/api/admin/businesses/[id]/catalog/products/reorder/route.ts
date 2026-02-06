import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../../../../modules/business"

/**
 * POST /admin/businesses/:id/catalog/products/reorder
 * Body: { product_ids: string[], location_id?: string, category_id?: string }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  const body = (req.body ?? {}) as Record<string, any>

  await businessService.retrieveBusiness(id)

  const productIds = Array.isArray(body.product_ids)
    ? body.product_ids.map((v: any) => String(v)).filter(Boolean)
    : []
  if (!productIds.length) {
    return res.status(400).json({ message: "product_ids array is required" })
  }

  const location = await businessService.getCatalogLocation(id, body.location_id)
  if (!location) {
    return res.status(400).json({
      message: "No active location found for this business. Create a location first.",
    })
  }

  for (let i = 0; i < productIds.length; i++) {
    const existing = await businessService.listLocationProducts({
      location_id: location.id,
      product_id: productIds[i],
    })

    if (!existing.length) continue

    const patch: Record<string, any> = { id: existing[0].id, rank: i }
    if (body.category_id !== undefined) {
      patch.category_id = body.category_id
    }
    await businessService.updateLocationProducts(patch)
  }

  const rows = await businessService.listLocationProducts({ location_id: location.id })
  rows.sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0))

  res.json({
    location,
    location_products: rows,
  })
}
