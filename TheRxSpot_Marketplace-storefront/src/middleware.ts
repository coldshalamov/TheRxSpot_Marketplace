import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

// Platform hostnames (exact matches only). Do NOT suffix-match, otherwise
// `tenant.therxspot.com` would be misclassified as "platform" and tenant resolution
// would be skipped.
const PLATFORM_HOSTNAMES = (
  process.env.PLATFORM_HOSTNAMES ||
  // Backward-compat (older env name).
  process.env.PLATFORM_DOMAINS ||
  "localhost,127.0.0.1"
)
  .split(",")
  .map((d) => d.trim().toLowerCase())

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

function isStaticFile(pathname: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff|woff2|ttf|eot|pdf|zip|mp4|mp3|json|xml)$/i.test(pathname)
}

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (!BACKEND_URL) {
    throw new Error(
      "Middleware.ts: Error fetching regions. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
    )
  }

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    const response = await fetch(`${BACKEND_URL}/store/regions`, {
      headers: {
        "x-publishable-api-key": PUBLISHABLE_API_KEY!,
      },
      next: {
        revalidate: 3600,
        tags: [`regions-${cacheId}`],
      },
      cache: "force-cache",
    })

    const rawBody = await response.text()
    let json: any = null

    if (rawBody) {
      try {
        json = JSON.parse(rawBody)
      } catch {
        throw new Error(
          `Middleware.ts: Invalid JSON from ${BACKEND_URL}/store/regions (status ${response.status}).`
        )
      }
    }

    if (!response.ok) {
      throw new Error(
        json?.message ||
          `Middleware.ts: Failed to fetch regions from ${BACKEND_URL} (status ${response.status}).`
      )
    }

    const regions = json?.regions

    if (!regions?.length) {
      throw new Error(
        "No regions found. Please set up regions in your Medusa Admin."
      )
    }

    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((c) => {
        regionMapCache.regionMap.set(c.iso_2 ?? "", region)
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  try {
    let countryCode

    const vercelCountryCode = request.headers
      .get("x-vercel-ip-country")
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Middleware.ts: Error getting the country code. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
      )
    }
  }
}

function isPlatformDomain(hostname: string): boolean {
  return PLATFORM_HOSTNAMES.includes(hostname)
}

function hasCountryCode(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean)
  return segments.length > 0 && /^[a-z]{2}$/i.test(segments[0])
}

/**
 * Resolve tenant config from the hostname by calling the backend.
 */
async function resolveTenantFromHostname(
  hostname: string
): Promise<Record<string, any> | null> {
  if (!BACKEND_URL || isPlatformDomain(hostname)) {
    return null
  }

  try {
    const res = await fetch(`${BACKEND_URL}/store/tenant-config`, {
      headers: { "x-tenant-host": hostname },
      cache: "no-store",
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  
  // Skip static files and API
  if (isStaticFile(pathname)) return NextResponse.next()

  // Checkout is intentionally out-of-scope for the MVP.
  const checkoutEnabled = (process.env.CHECKOUT_ENABLED || "").toLowerCase() === "true"
  if (!checkoutEnabled) {
    const segments = pathname.split("/").filter(Boolean)
    const maybeCountry = segments[0] || ""
    const restFirst = segments[1] || ""

    // Handle both /cart and /{country}/cart
    const isCartOrCheckout =
      restFirst === "cart" ||
      restFirst === "checkout" ||
      maybeCountry === "cart" ||
      maybeCountry === "checkout"

    if (isCartOrCheckout) {
      const countryCode = /^[a-z]{2}$/i.test(maybeCountry) ? maybeCountry.toLowerCase() : DEFAULT_REGION
      const url = request.nextUrl.clone()
      url.pathname = `/${countryCode}`
      url.search = ""
      return NextResponse.redirect(url)
    }
  }
  
  // Resolve tenant from hostname
  const hostname = request.headers.get('host')?.split(':')[0]?.toLowerCase() || ''
  const tenantConfig = await resolveTenantFromHostname(hostname)
  
  // Store in cookie for SSR
  const response = NextResponse.next()
  if (tenantConfig) {
    response.cookies.set('_tenant_config', JSON.stringify(tenantConfig), {
      maxAge: 300, // 5 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    })
  }
  
  // Add country code if missing
  if (!hasCountryCode(pathname)) {
    const cacheIdCookie = request.cookies.get("_medusa_cache_id")
    const cacheId = cacheIdCookie?.value || crypto.randomUUID()
    try {
      const regionMap = await getRegionMap(cacheId)
      const countryCode = regionMap && (await getCountryCode(request, regionMap))

      if (countryCode) {
        const url = request.nextUrl.clone()
        url.pathname = `/${countryCode}${pathname}`

        const redirectResponse = NextResponse.redirect(url)
        if (!cacheIdCookie) {
          redirectResponse.cookies.set("_medusa_cache_id", cacheId, {
            maxAge: 60 * 60 * 24,
          })
        }

        return redirectResponse
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Middleware.ts: Failed resolving regions in middleware.", error)
      }

      // Fallback to default region so middleware never hard-crashes requests.
      const url = request.nextUrl.clone()
      url.pathname = `/${DEFAULT_REGION}${pathname}`
      return NextResponse.redirect(url)
    }
  }
  
  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
