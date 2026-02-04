import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../modules/business"

const PLATFORM_DOMAINS = (process.env.PLATFORM_DOMAINS || "localhost,127.0.0.1")
  .split(",")
  .map((d) => d.trim().toLowerCase())

function extractHostname(host: string | undefined): string | null {
  if (!host) return null
  // Strip port
  return host.split(":")[0].toLowerCase()
}

function isPlatformDomain(hostname: string): boolean {
  return PLATFORM_DOMAINS.some(
    (pd) => hostname === pd || hostname.endsWith(`.${pd}`)
  )
}

export const tenantResolutionMiddleware = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  let business: any = null

  // 1. Host header -> BusinessDomain table lookup
  const host = req.headers["host"] as string | undefined
  const hostname = extractHostname(host)

  if (hostname && !isPlatformDomain(hostname)) {
    business = await businessModuleService.getBusinessByDomainFromTable(hostname)
    if (!business) {
      // Also try the legacy domain field on Business
      business = await businessModuleService.getBusinessByDomain(hostname)
    }
  }

  // 2. x-business-slug header (backward compat)
  if (!business) {
    const businessSlug = req.headers["x-business-slug"] as string
    if (businessSlug) {
      business = await businessModuleService.getBusinessBySlug(businessSlug)
    }
  }

  // 3. x-business-domain header (backward compat)
  if (!business) {
    const businessDomain = req.headers["x-business-domain"] as string
    if (businessDomain) {
      business = await businessModuleService.getBusinessByDomain(businessDomain)
    }
  }

  // 4. Query param ?business=slug (backward compat)
  if (!business && req.query.business) {
    business = await businessModuleService.getBusinessBySlug(req.query.business as string)
  }

  // Reject suspended businesses
  if (business && business.status === "suspended") {
    return res.status(404).json({ message: "Store not found" })
  }

  // Attach business to request context
  if (business) {
    ;(req as any).context = (req as any).context || {}
    ;(req as any).context.business = business
  }

  next()
}
