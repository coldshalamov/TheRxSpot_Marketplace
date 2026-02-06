import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../modules/business"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const business = (req as any).context?.business

  const filters: Record<string, any> = { is_active: true }

  if (business?.id) {
    filters.business_id = business.id
  }

  const categories = await businessModuleService.listProductCategories(filters)

  // Sort by rank
  categories.sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0))

  // Build tree structure for nested display
  const categoryMap = new Map(categories.map((c: any) => [c.id, { ...c, children: [] as any[] }]))
  const tree: any[] = []

  for (const cat of categoryMap.values()) {
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      categoryMap.get(cat.parent_id)!.children.push(cat)
    } else {
      tree.push(cat)
    }
  }

  res.json({ categories: tree })
}
