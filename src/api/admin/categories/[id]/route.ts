import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

// GET /admin/categories/:id - Get category by ID
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params

  const categories = await businessModuleService.listProductCategories({ id }, { take: 1 })

  if (!categories.length) {
    return res.status(404).json({ message: "Category not found" })
  }

  res.json({ category: categories[0] })
}

// PATCH /admin/categories/:id - Update category
export const PATCH = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params
  const { name, description, image_url, requires_consult, is_active, parent_id, rank } = req.body as {
    name?: string
    description?: string
    image_url?: string
    requires_consult?: boolean
    is_active?: boolean
    parent_id?: string | null
    rank?: number
  }

  const existing = await businessModuleService.listProductCategories({ id }, { take: 1 })

  if (!existing.length) {
    return res.status(404).json({ message: "Category not found" })
  }

  const updateData: Record<string, any> = { id }

  if (name !== undefined) updateData.name = name
  if (description !== undefined) updateData.description = description
  if (image_url !== undefined) updateData.image_url = image_url
  if (requires_consult !== undefined) updateData.requires_consult = requires_consult
  if (is_active !== undefined) updateData.is_active = is_active
  if (parent_id !== undefined) updateData.parent_id = parent_id
  if (rank !== undefined) updateData.rank = rank

  const category = await businessModuleService.updateProductCategories(updateData)

  res.json({ category })
}

// DELETE /admin/categories/:id - Delete category
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params

  const existing = await businessModuleService.listProductCategories({ id }, { take: 1 })

  if (!existing.length) {
    return res.status(404).json({ message: "Category not found" })
  }

  // Check if category has children
  const children = await businessModuleService.listProductCategories({ parent_id: id }, { take: 1 })

  if (children.length > 0) {
    return res.status(400).json({
      message: "Cannot delete category with children. Move or delete children first.",
    })
  }

  await businessModuleService.deleteProductCategories(id)

  res.status(200).json({ success: true, id })
}
