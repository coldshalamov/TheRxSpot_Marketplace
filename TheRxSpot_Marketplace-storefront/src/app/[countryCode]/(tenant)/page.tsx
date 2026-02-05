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
      <section
        className="py-24 medical-pattern"
        style={{
          backgroundColor: "var(--color-off-white)",
        }}
      >
        <div className="content-container">
          <div className="text-center mb-16 space-y-4 animate-fade-in-up">
            <h2
              className="text-5xl md:text-6xl font-display font-bold"
              style={{
                color: "var(--color-primary)",
              }}
            >
              Treatment Categories
            </h2>
            <p
              className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
              style={{
                color: "var(--color-text-secondary)",
              }}
            >
              Browse our comprehensive range of telehealth treatments and services,
              each designed with your health and convenience in mind.
            </p>
          </div>

          {topLevelCategories.length === 0 ? (
            <div
              className="text-center py-20 rounded-3xl card-elegant"
              style={{
                background: "var(--color-white)",
              }}
            >
              <div className="text-6xl mb-4 opacity-20">🏥</div>
              <p
                className="text-lg"
                style={{
                  color: "var(--color-text-tertiary)",
                }}
              >
                Treatment categories will be available soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {topLevelCategories.map((category, index) => (
                <div
                  key={category.id}
                  className={`animate-fade-in-up stagger-${Math.min(index + 1, 6)}`}
                >
                  <CategoryCard
                    category={category}
                    businessSlug={businessSlug}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section
        className="py-24 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--color-cream) 0%, var(--color-sage) 100%)",
        }}
      >
        {/* Decorative Elements */}
        <div
          className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{
            background: "var(--color-accent)",
          }}
        />

        <div className="content-container relative z-10">
          <div className="text-center mb-16 space-y-4 animate-fade-in-up">
            <h2
              className="text-5xl md:text-6xl font-display font-bold"
              style={{
                color: "var(--color-primary)",
              }}
            >
              How It Works
            </h2>
            <p
              className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
              style={{
                color: "var(--color-text-secondary)",
              }}
            >
              Getting started is simple. Follow these three steps to receive
              professional care from the comfort of your home.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Step 1 */}
            <div className="card-elegant p-8 space-y-6 text-center animate-fade-in-up stagger-2">
              <div className="relative inline-block">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                  style={{
                    background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)",
                    boxShadow: "var(--shadow-soft)",
                  }}
                >
                  <span className="text-4xl">🔍</span>
                </div>
                <div
                  className="absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center text-sm font-display font-bold"
                  style={{
                    background: "var(--color-accent)",
                    color: "white",
                  }}
                >
                  01
                </div>
              </div>

              <h3
                className="text-2xl font-display font-bold"
                style={{
                  color: "var(--color-text-primary)",
                }}
              >
                Choose Your Treatment
              </h3>

              <p
                className="text-base leading-relaxed"
                style={{
                  color: "var(--color-text-secondary)",
                }}
              >
                Browse our categories and select the treatment that fits your needs.
                Each option includes detailed information to help you decide.
              </p>
            </div>

            {/* Step 2 */}
            <div className="card-elegant p-8 space-y-6 text-center animate-fade-in-up stagger-3 lg:-translate-y-4">
              <div className="relative inline-block">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                  style={{
                    background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)",
                    boxShadow: "var(--shadow-soft)",
                  }}
                >
                  <span className="text-4xl">📋</span>
                </div>
                <div
                  className="absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center text-sm font-display font-bold"
                  style={{
                    background: "var(--color-accent)",
                    color: "white",
                  }}
                >
                  02
                </div>
              </div>

              <h3
                className="text-2xl font-display font-bold"
                style={{
                  color: "var(--color-text-primary)",
                }}
              >
                Complete Consultation
              </h3>

              <p
                className="text-base leading-relaxed"
                style={{
                  color: "var(--color-text-secondary)",
                }}
              >
                Answer a few health questions in our secure portal.
                A licensed provider will carefully review your information.
              </p>
            </div>

            {/* Step 3 */}
            <div className="card-elegant p-8 space-y-6 text-center animate-fade-in-up stagger-4">
              <div className="relative inline-block">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                  style={{
                    background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)",
                    boxShadow: "var(--shadow-soft)",
                  }}
                >
                  <span className="text-4xl">📦</span>
                </div>
                <div
                  className="absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center text-sm font-display font-bold"
                  style={{
                    background: "var(--color-accent)",
                    color: "white",
                  }}
                >
                  03
                </div>
              </div>

              <h3
                className="text-2xl font-display font-bold"
                style={{
                  color: "var(--color-text-primary)",
                }}
              >
                Receive Your Treatment
              </h3>

              <p
                className="text-base leading-relaxed"
                style={{
                  color: "var(--color-text-secondary)",
                }}
              >
                Once approved, your treatment ships discreetly and directly to your door.
                Quick, convenient, and completely private.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
