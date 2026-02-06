import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../../../modules/business"
import { sanitizeDetailsBlocks } from "../../../../../../../modules/business/utils/details-blocks"

function toOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * PATCH /admin/businesses/:id/catalog/products/:productId
 * Update card-level overrides for a single product.
 */
export const PATCH = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const { id, productId } = req.params
  const body = (req.body ?? {}) as Record<string, any>

  await businessService.retrieveBusiness(id)

  const location = await businessService.getCatalogLocation(id, body.location_id)
  if (!location) {
    return res.status(400).json({
      message: "No active location found for this business. Create a location first.",
    })
  }

  const existing = await businessService.listLocationProducts({
    location_id: location.id,
    product_id: productId,
  })
  if (!existing.length) {
    return res.status(404).json({ message: "Product is not assigned to this catalog location" })
  }

  const patch: Record<string, any> = {
    id: existing[0].id,
  }

  if (body.category_id !== undefined) patch.category_id = body.category_id
  if (body.custom_price !== undefined) patch.custom_price = toOptionalNumber(body.custom_price)
  if (body.is_active !== undefined) patch.is_active = !!body.is_active
  if (body.rank !== undefined) patch.rank = Number(body.rank) || 0
  if (body.display_title !== undefined) patch.display_title = body.display_title
  if (body.display_description !== undefined) patch.display_description = body.display_description
  if (body.display_image_url !== undefined) patch.display_image_url = body.display_image_url
  if (body.details_blocks !== undefined) {
    patch.details_blocks = sanitizeDetailsBlocks(body.details_blocks)
  }

  const updated = await businessService.updateLocationProducts(patch)
  res.json({ location_product: updated })
}

/**
 * DELETE /admin/businesses/:id/catalog/products/:productId
 * Remove product from catalog location.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const { id, productId } = req.params
  const body = (req.body ?? {}) as Record<string, any>

  await businessService.retrieveBusiness(id)

  const location = await businessService.getCatalogLocation(id, body.location_id)
  if (!location) {
    return res.status(400).json({
      message: "No active location found for this business. Create a location first.",
    })
  }

  const existing = await businessService.listLocationProducts({
    location_id: location.id,
    product_id: productId,
  })
  if (!existing.length) {
    return res.status(404).json({ message: "Product is not assigned to this catalog location" })
  }

  await businessService.deleteLocationProducts(existing[0].id)
  res.status(200).json({ success: true })
}
