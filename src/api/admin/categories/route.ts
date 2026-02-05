import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../modules/business"

// GET /admin/categories - List all categories (optionally by business)
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { business_id, tree } = req.query as { business_id?: string; tree?: string }

  const filters: Record<string, any> = {}
  if (business_id) {
    filters.business_id = business_id
  }

  const categories = await businessModuleService.listProductCategories(
    filters,
    { order: { rank: "ASC" } }
  )

  // If tree=true, return hierarchical structure
  if (tree === "true") {
    const categoryMap = new Map(categories.map(c => [c.id, { ...c, children: [] as any[] }]))
    const treeResult: any[] = []

    for (const cat of categoryMap.values()) {
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        categoryMap.get(cat.parent_id)!.children.push(cat)
      } else {
        treeResult.push(cat)
      }
    }

    return res.json({ categories: treeResult })
  }

  res.json({ categories })
}

// POST /admin/categories - Create a new category
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const { business_id, parent_id, name, description, image_url, requires_consult, is_active } = req.body as {
    business_id: string
    parent_id?: string
    name: string
    description?: string
    image_url?: string
    requires_consult?: boolean
    is_active?: boolean
  }

  if (!business_id || !name) {
    return res.status(400).json({ message: "business_id and name are required" })
  }

  // Get max rank for this parent level
  const siblingFilter: Record<string, any> = { business_id }
  if (parent_id) {
    siblingFilter.parent_id = parent_id
  } else {
    siblingFilter.parent_id = null
  }

  const siblings = await businessModuleService.listProductCategories(
    siblingFilter,
    { order: { rank: "DESC" }, take: 1 }
  )

  const nextRank = siblings.length > 0 ? (siblings[0].rank ?? 0) + 1 : 0

  const category = await businessModuleService.createProductCategories({
    business_id,
    parent_id: parent_id ?? null,
    name,
    description: description ?? null,
    image_url: image_url ?? null,
    requires_consult: requires_consult ?? false,
    is_active: is_active ?? true,
    rank: nextRank,
  })

  res.status(201).json({ category })
}
