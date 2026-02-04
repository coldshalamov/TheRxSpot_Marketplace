// lib/business.ts - Business/tenant resolution utilities

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export interface Business {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  custom_html_head: string | null
  custom_html_body: string | null
  domain: string | null
  is_active: boolean
  status: string
  branding_config: Record<string, any>
  domain_config: Record<string, any>
  catalog_config: Record<string, any>
  settings: Record<string, any>
  sales_channel_id: string | null
  publishable_api_key_id: string | null
}

export interface Location {
  id: string
  business_id: string
  name: string
  phone: string
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  serviceable_states: string[]
  is_active: boolean
}

export interface ProductCategory {
  id: string
  name: string
  description: string | null
  image_url: string | null
  requires_consult: boolean
  sort_order: number
  is_active: boolean
}

export interface ConsultSubmission {
  id: string
  business_id: string
  location_id: string | null
  product_id: string
  customer_email: string
  customer_first_name: string
  customer_last_name: string
  customer_phone: string | null
  customer_dob: string | null
  eligibility_answers: Record<string, any>
  status: "pending" | "approved" | "rejected" | "expired"
  consult_fee: string | null
  notes: string | null
}

// Resolve business by hostname or slug
export async function resolveBusiness(
  hostname: string,
  slug?: string
): Promise<Business | null> {
  if (slug) {
    return fetchBusinessBySlug(slug)
  }

  // Try tenant-config endpoint first (uses Host header resolution)
  const tenantBusiness = await fetchBusinessByHostname(hostname)
  if (tenantBusiness) return tenantBusiness

  // Fallback to domain field match
  return fetchBusinessByDomain(hostname)
}

async function fetchBusinessByHostname(hostname: string): Promise<Business | null> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/tenant-config`, {
      headers: { host: hostname },
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const data = await res.json()
    // tenant-config returns a subset; fetch full business
    if (data.business?.slug) {
      return fetchBusinessBySlug(data.business.slug)
    }
    return null
  } catch {
    return null
  }
}

async function fetchBusinessBySlug(slug: string): Promise<Business | null> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/businesses/${slug}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.business
  } catch {
    return null
  }
}

async function fetchBusinessByDomain(domain: string): Promise<Business | null> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/businesses`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.businesses.find((b: Business) => b.domain === domain) || null
  } catch {
    return null
  }
}

export async function fetchBusinessLocations(businessSlug: string): Promise<Location[]> {
  try {
    const res = await fetch(
      `${MEDUSA_BACKEND_URL}/store/businesses/${businessSlug}/locations`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.locations
  } catch {
    return []
  }
}

export async function fetchProductCategories(): Promise<ProductCategory[]> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/product-categories`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.categories
  } catch {
    return []
  }
}

export async function submitConsult(
  businessSlug: string,
  submission: Omit<ConsultSubmission, "id" | "business_id" | "status">
): Promise<ConsultSubmission | null> {
  try {
    const res = await fetch(
      `${MEDUSA_BACKEND_URL}/store/businesses/${businessSlug}/consult`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.submission
  } catch {
    return null
  }
}
