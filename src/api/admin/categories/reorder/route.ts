import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

// POST /admin/categories/reorder - Bulk reorder categories
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { category_ids, parent_id } = req.body as {
    category_ids: string[]
    parent_id?: string | null
  }

  if (!Array.isArray(category_ids) || category_ids.length === 0) {
    return res.status(400).json({ message: "category_ids array is required" })
  }

  // Update each category with new rank and optional parent_id
  const updates = category_ids.map((id, index) => ({
    id,
    rank: index,
    ...(parent_id !== undefined ? { parent_id } : {}),
  }))

  for (const update of updates) {
    await businessModuleService.updateProductCategories(update)
  }

  // Fetch updated categories
  const categories = await businessModuleService.listProductCategories(
    { id: category_ids },
    { order: { rank: "ASC" } }
  )

  res.json({ categories })
}
