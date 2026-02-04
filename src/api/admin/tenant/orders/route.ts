import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const tenantContext = (req as any).tenant_context
  if (!tenantContext) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Query orders linked to this business via the business-order link
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "total",
      "currency_code",
      "created_at",
      "email",
      "items.*",
    ],
    filters: {
      business: {
        id: tenantContext.business_id,
      },
    },
  })

  res.json({ orders })
}
