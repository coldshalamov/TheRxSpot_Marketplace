import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../../modules/business"

// POST /admin/locations/:locationId/products/reorder - Reorder products in location
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { locationId } = req.params
  const { product_ids, category_id } = req.body as {
    product_ids: string[]
    category_id?: string
  }

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ message: "product_ids array is required" })
  }

  for (let i = 0; i < product_ids.length; i++) {
    const existing = await businessModuleService.listLocationProducts({ location_id: locationId, product_id: product_ids[i] })

    if (existing.length > 0) {
      const updateData: Record<string, any> = {
        id: existing[0].id,
        rank: i,
      }
      if (category_id !== undefined) {
        updateData.category_id = category_id
      }
      await businessModuleService.updateLocationProducts(updateData)
    }
  }

  // Fetch updated products
  const allLocationProducts = await businessModuleService.listLocationProducts({ location_id: locationId })
  const locationProducts = allLocationProducts
    .filter((lp: any) => product_ids.includes(lp.product_id))
    .sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0))

  res.json({ location_products: locationProducts })
}
