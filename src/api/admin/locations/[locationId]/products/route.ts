import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../modules/business"
import { Modules } from "@medusajs/framework/utils"

// GET /admin/locations/:locationId/products - List products assigned to location
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { locationId } = req.params

  // Get location products
  const locationProducts = await businessModuleService.listLocationProducts({ location_id: locationId })

  // Sort by rank
  locationProducts.sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0))

  if (!locationProducts.length) {
    return res.json({ products: [] })
  }

  // Get product details from Medusa product module
  const productIds = locationProducts.map((lp: any) => lp.product_id)
  const products = await productService.listProducts(
    { id: productIds },
    {
      relations: ["variants", "variants.prices"],
    }
  )

  // Merge location product data with product details
  const productMap = new Map(products.map((p: any) => [p.id, p]))
  const result = locationProducts
    .map((lp: any) => {
      const product = productMap.get(lp.product_id)
      if (!product) return null
      return {
        ...product,
        location_product_id: lp.id,
        category_id: lp.category_id,
        custom_price: lp.custom_price,
        is_active: lp.is_active,
        rank: lp.rank,
      }
    })
    .filter(Boolean)

  res.json({ products: result })
}

// POST /admin/locations/:locationId/products - Assign products to location
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { locationId } = req.params
  const { product_id, product_ids, category_id, custom_price } = req.body as {
    product_id?: string
    product_ids?: string[]
    category_id?: string
    custom_price?: number
  }

  const idsToAssign = product_ids ?? (product_id ? [product_id] : [])

  if (idsToAssign.length === 0) {
    return res.status(400).json({ message: "product_id or product_ids is required" })
  }

  // Get current max rank
  const existing = await businessModuleService.listLocationProducts({ location_id: locationId })
  existing.sort((a: any, b: any) => (b.rank ?? 0) - (a.rank ?? 0))
  let nextRank = existing.length > 0 ? (existing[0].rank ?? 0) + 1 : 0

  const created: any[] = []

  for (const productId of idsToAssign) {
    // Check if already exists
    const existingProduct = await businessModuleService.listLocationProducts({ location_id: locationId, product_id: productId })

    if (existingProduct.length > 0) {
      // Update existing
      const updated = await businessModuleService.updateLocationProducts({
        id: existingProduct[0].id,
        is_active: true,
        category_id: category_id ?? existingProduct[0].category_id,
        custom_price: custom_price ?? existingProduct[0].custom_price,
      })
      created.push(updated)
    } else {
      // Create new
      const locationProduct = await businessModuleService.createLocationProducts({
        location_id: locationId,
        product_id: productId,
        category_id: category_id ?? null,
        custom_price: custom_price ?? null,
        is_active: true,
        rank: nextRank++,
      })
      created.push(locationProduct)
    }
  }

  res.status(201).json({ location_products: created })
}

// DELETE /admin/locations/:locationId/products - Remove products from location
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { locationId } = req.params
  const { product_id, product_ids } = req.body as {
    product_id?: string
    product_ids?: string[]
  }

  const idsToRemove = product_ids ?? (product_id ? [product_id] : [])

  if (idsToRemove.length === 0) {
    return res.status(400).json({ message: "product_id or product_ids is required" })
  }

  for (const productId of idsToRemove) {
    const existing = await businessModuleService.listLocationProducts({ location_id: locationId, product_id: productId })

    if (existing.length > 0) {
      await businessModuleService.deleteLocationProducts(existing[0].id)
    }
  }

  res.json({ success: true, removed_count: idsToRemove.length })
}
