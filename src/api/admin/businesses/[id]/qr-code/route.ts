import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../modules/business"
import QRCode from "qrcode"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  const business = await businessModuleService.retrieveBusiness(id)
  const qrDataUrl = business.settings?.qr_code_data_url || null

  res.json({ qr_code_data_url: qrDataUrl })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  const business = await businessModuleService.retrieveBusiness(id)
  const storefrontUrl =
    business.settings?.storefront_url || `http://localhost:8000`

  const qrCodeDataUrl = await QRCode.toDataURL(storefrontUrl, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  })

  const settings = { ...(business.settings as object), qr_code_data_url: qrCodeDataUrl }

  await businessModuleService.updateBusinesses({
    selector: { id },
    data: { settings },
  })

  res.json({ qr_code_data_url: qrCodeDataUrl })
}
