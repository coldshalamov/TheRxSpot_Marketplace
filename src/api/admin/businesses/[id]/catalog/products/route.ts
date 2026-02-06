import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../../modules/business"
import { sanitizeDetailsBlocks } from "../../../../../../modules/business/utils/details-blocks"

function toOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * POST /admin/businesses/:id/catalog/products
 * Assign one or more products to the business catalog location.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  const body = (req.body ?? {}) as Record<string, any>

  await businessService.retrieveBusiness(id)

  const location = await businessService.getCatalogLocation(id, body.location_id)
  if (!location) {
    return res.status(400).json({
      message: "No active location found for this business. Create a location first.",
    })
  }

  const idsToAssign = Array.isArray(body.product_ids)
    ? body.product_ids.map((v: any) => String(v)).filter(Boolean)
    : body.product_id
      ? [String(body.product_id)]
      : []

  if (!idsToAssign.length) {
    return res.status(400).json({ message: "product_id or product_ids is required" })
  }

  const existing = await businessService.listLocationProducts({ location_id: location.id })
  existing.sort((a: any, b: any) => (b.rank ?? 0) - (a.rank ?? 0))
  let nextRank = existing.length ? (existing[0].rank ?? 0) + 1 : 0

  const createdOrUpdated: any[] = []
  for (const productId of idsToAssign) {
    const found = await businessService.listLocationProducts({
      location_id: location.id,
      product_id: productId,
    })

    const detailsBlocks =
      body.details_blocks !== undefined
        ? sanitizeDetailsBlocks(body.details_blocks)
        : undefined

    const updateData: Record<string, any> = {
      category_id: body.category_id ?? undefined,
      custom_price: toOptionalNumber(body.custom_price),
      is_active: body.is_active !== undefined ? !!body.is_active : true,
      display_title: body.display_title ?? undefined,
      display_description: body.display_description ?? undefined,
      display_image_url: body.display_image_url ?? undefined,
      details_blocks: detailsBlocks as any,
    }

    if (found.length) {
      const payload: Record<string, any> = { id: found[0].id }
      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined) payload[key] = value
      })
      const updated = await businessService.updateLocationProducts(payload)
      createdOrUpdated.push(updated)
      continue
    }

    const created = await businessService.createLocationProducts({
      location_id: location.id,
      product_id: productId,
      category_id: body.category_id ?? null,
      custom_price: toOptionalNumber(body.custom_price) ?? null,
      is_active: body.is_active !== undefined ? !!body.is_active : true,
      rank: nextRank++,
      display_title: body.display_title ?? null,
      display_description: body.display_description ?? null,
      display_image_url: body.display_image_url ?? null,
      details_blocks: (detailsBlocks ?? []) as any,
    })
    createdOrUpdated.push(created)
  }

  res.status(201).json({
    location,
    location_products: createdOrUpdated,
  })
}
