import { Metadata } from "next"
import { cookies } from "next/headers"

import { getRegion } from "@lib/data/regions"
import { getTenantConfigFromCookie } from "@lib/tenant"
import { fetchProductCategories, resolveBusiness, fetchBusinessLocations } from "@lib/business"
import Hero from "@modules/home/components/hero"
import { CategoryCard } from "@/components/category-card"
import { TenantHero } from "@/components/tenant-hero"

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get("_tenant_config")?.value
  const tenantConfig = getTenantConfigFromCookie(tenantCookie)

  if (tenantConfig?.business?.name) {
    return {
      title: `${tenantConfig.business.name} | Telehealth Services`,
      description: `Professional telehealth services at ${tenantConfig.business.name}. Get the care you need from the comfort of your home.`,
    }
  }

  return {
    title: "Telehealth Store",
    description: "Professional telehealth services. Get the care you need from the comfort of your home.",
  }
}

export default async function TenantHome(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params

  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get("_tenant_config")?.value
  const tenantConfig = getTenantConfigFromCookie(tenantCookie)

  const region = await getRegion(countryCode)
  if (!region) {
    return null
  }

  const businessSlug = tenantConfig?.business?.slug || ""
  const business = businessSlug ? await resolveBusiness("", businessSlug) : null
  const categories = await fetchProductCategories(businessSlug)

  // Filter to only top-level categories (no parent)
  const topLevelCategories = categories.filter((c) => !c.parent_id)

  return (
    <>
      {business ? (
        <TenantHero business={business} />
      ) : (
        <Hero />
      )}

      {/* Categories Section */}
      <section className="py-16 bg-gray-50">
        <div className="content-container">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Our Treatment Categories</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Browse our comprehensive range of telehealth treatments and services
            </p>
          </div>

          {topLevelCategories.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>Categories coming soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {topLevelCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  businessSlug={businessSlug}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16">
        <div className="content-container">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">How It Works</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Getting started is easy. Follow these simple steps to receive your treatment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-lg mb-2">Choose Your Treatment</h3>
              <p className="text-gray-600">
                Browse our categories and select the treatment that fits your needs.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-lg mb-2">Complete Consultation</h3>
              <p className="text-gray-600">
                Answer a few health questions. A licensed provider will review your information.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-lg mb-2">Receive Your Treatment</h3>
              <p className="text-gray-600">
                Once approved, your treatment ships directly to your door.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
