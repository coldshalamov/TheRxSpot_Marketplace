import { Metadata } from "next"
import { cookies } from "next/headers"
import { getTenantConfigFromCookie } from "@lib/tenant"
import { fetchProductCategories } from "@lib/business"
import { CategoryCard } from "@/components/category-card"

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get("_tenant_config")?.value
  const tenantConfig = getTenantConfigFromCookie(tenantCookie)

  const storeName = tenantConfig?.business?.name || "Store"
  return {
    title: `Categories | ${storeName}`,
    description: `Browse treatment categories at ${storeName}`,
  }
}

export default async function CategoriesPage() {
  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get("_tenant_config")?.value
  const tenantConfig = getTenantConfigFromCookie(tenantCookie)

  const businessSlug = tenantConfig?.business?.slug || ""
  const categories = await fetchProductCategories(businessSlug)

  // Filter to only top-level categories (no parent)
  const topLevelCategories = categories.filter((c) => !c.parent_id)

  return (
    <div className="content-container py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Treatment Categories</h1>
        <p className="text-gray-600">
          Browse our available treatments and services
        </p>
      </div>

      {topLevelCategories.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No categories available at this time.</p>
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
  )
}
