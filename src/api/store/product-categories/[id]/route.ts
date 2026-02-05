import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { id } = req.params

  try {
    const category = await businessModuleService.retrieveProductCategory(id)

    if (!category || !category.is_active) {
      return res.status(404).json({ message: "Category not found" })
    }

    // Get children categories
    const children = await businessModuleService.listProductCategories({
      parent_id: id,
      is_active: true,
    })
    children.sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0))

    res.json({
      category: {
        ...category,
        children,
      },
    })
  } catch {
    return res.status(404).json({ message: "Category not found" })
  }
}
