import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { provisionBusinessWorkflow } from "../../../../../workflows/provision-business"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  const { result } = await provisionBusinessWorkflow(req.scope).run({
    input: {
      business_id: id,
      storefront_base_url: (req.body as any)?.storefront_base_url,
    },
  })

  res.json({ business: result })
}
