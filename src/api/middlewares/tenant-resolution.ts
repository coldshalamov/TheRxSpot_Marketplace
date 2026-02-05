import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../modules/business"
import { setTenantInLogContext } from "./request-context"

/**
 * Platform hostnames (exact matches only).
 *
 * IMPORTANT:
 * - We intentionally do NOT suffix-match (no `endsWith(.therxspot.com)`), otherwise
 *   `tenant.therxspot.com` would be incorrectly classified as a platform host.
 * - This middleware is used behind Vercel/Render rewrites where the backend host
 *   may be `api.therxspot.com`, but the tenant host is passed via `x-tenant-host`.
 */
const PLATFORM_HOSTNAMES = (
  process.env.PLATFORM_HOSTNAMES ||
  // Backward-compat: older env name; treat as exact hostnames too.
  process.env.PLATFORM_DOMAINS ||
  "localhost,127.0.0.1"
)
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

function normalizeHostHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) return null
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null

  // May be comma-separated, may include port.
  const first = raw.split(",")[0]?.trim()
  if (!first) return null

  // Strip port (IPv6-safe enough for our use: treat bracketed host as-is).
  const withoutPort = first.includes("]")
    ? first
    : first.split(":")[0]

  return withoutPort.toLowerCase()
}

function isPlatformHostname(hostname: string): boolean {
  return PLATFORM_HOSTNAMES.includes(hostname)
}

export const tenantResolutionMiddleware = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)

  let business: any = null

  // 1. Tenant host header -> BusinessDomain table lookup
  // Preferred: x-tenant-host (forwarded by storefront)
  // Fallbacks: x-forwarded-host, host
  const tenantHost =
    normalizeHostHeaderValue(req.headers["x-tenant-host"] as any) ||
    normalizeHostHeaderValue(req.headers["x-forwarded-host"] as any) ||
    normalizeHostHeaderValue(req.headers["host"] as any)

  if (tenantHost && !isPlatformHostname(tenantHost)) {
    business = await businessModuleService.getBusinessByDomainFromTable(tenantHost)
    if (!business) {
      // Also try the legacy domain field on Business
      business = await businessModuleService.getBusinessByDomain(tenantHost)
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
    setTenantInLogContext(req)
  }

  next()
}
