// lib/tenant.ts - Per-tenant configuration resolution and caching

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export interface TenantBranding {
  primary_color: string | null
  secondary_color: string | null
  accent_color?: string | null
  font_family?: string | null
  logo_url?: string | null
  [key: string]: any
}

export interface TenantConfig {
  business: {
    id: string
    name: string
    slug: string
    logo_url: string | null
    domain: string | null
    status: string
  }
  branding: TenantBranding
  catalog_config: Record<string, any>
  publishable_api_key: string | null
  sales_channel_id: string | null
}

// In-memory cache with TTL
const tenantCache = new Map<string, { config: TenantConfig; expires: number }>()
const CACHE_TTL_MS = 60_000 // 1 minute

export async function getTenantConfig(
  hostname: string
): Promise<TenantConfig | null> {
  const cached = tenantCache.get(hostname)
  if (cached && cached.expires > Date.now()) {
    return cached.config
  }

  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/tenant-config`, {
      headers: {
        host: hostname,
      },
      cache: "no-store",
    })

    if (!res.ok) return null

    const config: TenantConfig = await res.json()
    tenantCache.set(hostname, { config, expires: Date.now() + CACHE_TTL_MS })
    return config
  } catch {
    return null
  }
}

export function getTenantConfigFromCookie(
  cookieValue: string | undefined
): TenantConfig | null {
  if (!cookieValue) return null
  try {
    return JSON.parse(decodeURIComponent(cookieValue))
  } catch {
    return null
  }
}

export function serializeTenantConfig(config: TenantConfig): string {
  return encodeURIComponent(JSON.stringify(config))
}
