import { Metadata } from "next"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getTenantConfigFromCookie } from "@lib/tenant"
import { fetchCategoryById, fetchProductCategories } from "@lib/business"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { ProductCard } from "@/components/product-card"
import { CategoryCard } from "@/components/category-card"

type Props = {
  params: Promise<{ countryCode: string; id: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const category = await fetchCategoryById(params.id)

  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get("_tenant_config")?.value
  const tenantConfig = getTenantConfigFromCookie(tenantCookie)
  const storeName = tenantConfig?.business?.name || "Store"

  if (!category) {
    return { title: `Category | ${storeName}` }
  }

  return {
    title: `${category.name} | ${storeName}`,
    description: category.description || `Browse ${category.name} treatments`,
  }
}

export default async function CategoryPage(props: Props) {
  const params = await props.params
  const { countryCode, id } = params

  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get("_tenant_config")?.value
  const tenantConfig = getTenantConfigFromCookie(tenantCookie)
  const businessSlug = tenantConfig?.business?.slug || ""

  const category = await fetchCategoryById(id)

  if (!category) {
    notFound()
  }

  const region = await getRegion(countryCode)
  if (!region) {
    notFound()
  }

  // Fetch products that belong to this category
  // Products are linked via metadata.category_id
  const { response } = await listProducts({
    countryCode,
    queryParams: {
      limit: 50,
    },
  })

  // Filter products by category_id in metadata
  const categoryProducts = response.products.filter(
    (p: any) => p.metadata?.category_id === id
  )

  // Check for subcategories
  const hasSubcategories = category.children && category.children.length > 0

  return (
    <div className="content-container py-12">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm">
        <ol className="flex items-center gap-2 text-gray-500">
          <li>
            <Link href={`/${countryCode}`} className="hover:text-gray-900">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link
              href={`/${countryCode}/categories`}
              className="hover:text-gray-900"
            >
              Categories
            </Link>
          </li>
          <li>/</li>
          <li className="text-gray-900 font-medium">{category.name}</li>
        </ol>
      </nav>

      {/* Category Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{category.name}</h1>
        {category.description && (
          <p className="text-gray-600">{category.description}</p>
        )}
        {category.requires_consult && (
          <span className="inline-block mt-2 text-sm px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
            Consultation Required
          </span>
        )}
      </div>

      {/* Subcategories */}
      {hasSubcategories && (
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Subcategories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {category.children!.map((subcat) => (
              <CategoryCard
                key={subcat.id}
                category={subcat}
                businessSlug={businessSlug}
              />
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {hasSubcategories ? "All Products" : "Products"}
        </h2>

        {categoryProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 border rounded-lg">
            <p>No products available in this category.</p>
            <Link
              href={`/${countryCode}/categories`}
              className="inline-block mt-4 text-sm text-blue-600 hover:underline"
            >
              Browse other categories
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categoryProducts.map((product: any) => (
              <ProductCard
                key={product.id}
                product={product}
                businessSlug={businessSlug}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
