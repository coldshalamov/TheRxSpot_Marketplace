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

  const storefrontUrl = String(
    (business.settings as any)?.storefront_url ?? "http://localhost:8000"
  )

  const qrCodeDataUrl = await QRCode.toDataURL(storefrontUrl, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  })

  const existingSettings = (business.settings ?? {}) as Record<string, any>
  const settings = { ...existingSettings, qr_code_data_url: qrCodeDataUrl }

  await businessModuleService.updateBusinesses({ id, settings } as any)

  res.json({ qr_code_data_url: qrCodeDataUrl })
}
