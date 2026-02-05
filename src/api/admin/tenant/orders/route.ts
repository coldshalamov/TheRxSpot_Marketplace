import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = (req as any).tenant_context
  if (!tenantContext) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: businesses } = await query.graph({
    entity: "business",
    fields: [
      "id",
      "orders.id",
      "orders.display_id",
      "orders.status",
      "orders.total",
      "orders.currency_code",
      "orders.created_at",
      "orders.email",
      "orders.items.*",
    ],
    filters: { id: tenantContext.business_id },
  })

  const business = businesses?.[0] as any
  const orders = ((business?.orders ?? []) as any[]).filter(Boolean)

  res.json({ orders })
}
