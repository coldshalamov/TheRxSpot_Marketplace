import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Badge,
  Input,
  Toaster,
  toast,
} from "@medusajs/ui"
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"

interface ProductVariant {
  id: string
  title: string
  sku?: string
  prices?: Array<{ amount: number; currency_code: string }>
}

interface Product {
  id: string
  title: string
  thumbnail?: string
  variants?: ProductVariant[]
  location_product_id?: string
  category_id?: string
  custom_price?: number
  is_active?: boolean
  rank?: number
}

interface Category {
  id: string
  name: string
  parent_id: string | null
  rank: number
  is_active: boolean
  children?: Category[]
  products?: Product[]
}

const ManageProductsPage = () => {
  const { locationId } = useParams()
  const navigate = useNavigate()

  const [location, setLocation] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [assignedProducts, setAssignedProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [locationId])

  const fetchData = async () => {
    try {
      // Fetch location details
      const locationRes = await fetch(`/admin/businesses/*/locations/${locationId}`, {
        credentials: "include",
      }).catch(() => null)

      // Fetch assigned products for this location
      const productsRes = await fetch(`/admin/locations/${locationId}/products`, {
        credentials: "include",
      })
      const productsData = await productsRes.json()
      setAssignedProducts(productsData.products || [])

      // Fetch all products from Medusa
      const allProductsRes = await fetch(`/admin/products?limit=200`, {
        credentials: "include",
      })
      const allProductsData = await allProductsRes.json()
      setAllProducts(allProductsData.products || [])

      // Fetch categories for the business
      const categoriesRes = await fetch(`/admin/categories?tree=true`, {
        credentials: "include",
      })
      const categoriesData = await categoriesRes.json()
      setCategories(categoriesData.categories || [])
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast.error("Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const toggleProduct = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  const getStartingPrice = (product: Product): number | null => {
    if (!product.variants?.length) return null
    let minPrice: number | null = null
    for (const variant of product.variants) {
      if (variant.prices) {
        for (const price of variant.prices) {
          if (minPrice === null || price.amount < minPrice) {
            minPrice = price.amount
          }
        }
      }
    }
    return minPrice ? minPrice / 100 : null
  }

  const formatPrice = (amount: number | null): string => {
    if (amount === null) return "-"
    return `$${amount.toFixed(0)}`
  }

  const handleToggleActive = async (product: Product) => {
    try {
      await fetch(`/admin/locations/${locationId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          product_id: product.id,
          is_active: !product.is_active,
        }),
      })
      fetchData()
    } catch {
      toast.error("Failed to update product status")
    }
  }

  const handleRemoveProduct = async (productId: string) => {
    try {
      await fetch(`/admin/locations/${locationId}/products`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ product_id: productId }),
      })
      toast.success("Product removed")
      fetchData()
    } catch {
      toast.error("Failed to remove product")
    }
  }

  // Group assigned products by category
  const productsByCategory = new Map<string | null, Product[]>()
  for (const product of assignedProducts) {
    const catId = product.category_id || null
    if (!productsByCategory.has(catId)) {
      productsByCategory.set(catId, [])
    }
    productsByCategory.get(catId)!.push(product)
  }

  const renderVariant = (variant: ProductVariant, product: Product) => {
    const price = variant.prices?.find(p => p.currency_code === "usd")
    return (
      <div
        key={variant.id}
        className="flex items-center justify-between py-2 px-4 pl-16 border-b border-gray-100 bg-gray-50"
      >
        <div className="flex items-center gap-4">
          <Badge color="grey" size="small">
            {variant.title?.split(" - ")[0] || "Variant"}
          </Badge>
          <span className="text-sm text-gray-600">
            {variant.title || variant.sku}
          </span>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-xs text-gray-500">Cost To Business</div>
            <div className="font-medium">-</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Selling Price</div>
            <div className="font-medium">
              {price ? `$${(price.amount / 100).toFixed(0)}` : "-"}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderProduct = (product: Product) => {
    const isExpanded = expandedProducts.has(product.id)
    const startingPrice = getStartingPrice(product)
    const variantCount = product.variants?.length || 0

    return (
      <div key={product.id} className="border-b border-gray-200">
        <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50">
          {/* Drag handle */}
          <div className="flex items-center gap-3">
            <button className="cursor-grab text-gray-400 hover:text-gray-600">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="4" cy="3" r="1.5" />
                <circle cx="4" cy="8" r="1.5" />
                <circle cx="4" cy="13" r="1.5" />
                <circle cx="10" cy="3" r="1.5" />
                <circle cx="10" cy="8" r="1.5" />
                <circle cx="10" cy="13" r="1.5" />
              </svg>
            </button>
            {/* Expand/collapse */}
            <button
              onClick={() => toggleProduct(product.id)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`transform transition-transform ${isExpanded ? "rotate-90" : ""}`}
              >
                <path d="M6 4l8 6-8 6V4z" />
              </svg>
            </button>
            {/* Thumbnail */}
            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
              {product.thumbnail ? (
                <img src={product.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              )}
            </div>
            {/* Product info */}
            <div>
              <div className="font-medium">{product.title}</div>
              <div className="text-sm text-gray-500">{variantCount} dosages available</div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-6">
            {/* Starting price */}
            <div className="text-right w-24">
              <div className="text-xs text-gray-500">Starting Price</div>
              <div className="font-medium text-blue-600">
                {formatPrice(startingPrice)}
                <button className="ml-1 text-gray-400 hover:text-gray-600">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M9.5 1.5l1 1-7 7-2 1 1-2 7-7z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Status badge */}
            <Badge color={product.is_active !== false ? "green" : "grey"} size="small">
              {product.is_active !== false ? "ACTIVE" : "INACTIVE"}
            </Badge>

            {/* Edit button */}
            <button className="text-gray-400 hover:text-gray-600">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M15.5 2.5l2 2-9 9-3 1 1-3 9-9z" />
              </svg>
            </button>

            {/* Delete button */}
            <button
              onClick={() => handleRemoveProduct(product.id)}
              className="text-red-400 hover:text-red-600"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 4h10v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4z" />
                <path d="M3 4h14M8 4V2h4v2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Variants */}
        {isExpanded && product.variants && (
          <div className="bg-gray-50">
            {product.variants.map(variant => renderVariant(variant, product))}
          </div>
        )}
      </div>
    )
  }

  const renderCategory = (category: Category, level = 0) => {
    const isExpanded = expandedCategories.has(category.id)
    const categoryProducts = productsByCategory.get(category.id) || []
    const productCount = categoryProducts.length

    return (
      <div key={category.id} className="border border-gray-200 rounded-lg mb-4 bg-white shadow-sm">
        {/* Category header */}
        <div
          className="flex items-center justify-between py-4 px-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleCategory(category.id)}
        >
          <div className="flex items-center gap-3">
            {/* Drag handle */}
            <button className="cursor-grab text-gray-400">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="4" cy="3" r="1.5" />
                <circle cx="4" cy="8" r="1.5" />
                <circle cx="4" cy="13" r="1.5" />
                <circle cx="10" cy="3" r="1.5" />
                <circle cx="10" cy="8" r="1.5" />
                <circle cx="10" cy="13" r="1.5" />
              </svg>
            </button>
            {/* Expand arrow */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`transform transition-transform ${isExpanded ? "rotate-90" : ""}`}
            >
              <path d="M6 4l8 6-8 6V4z" />
            </svg>
            {/* Category name */}
            <div>
              <div className="font-semibold text-lg">{category.name}</div>
              <div className="text-sm text-gray-500">{productCount} products</div>
            </div>
          </div>
        </div>

        {/* Products in this category */}
        {isExpanded && (
          <div className="border-t border-gray-200">
            {categoryProducts.map(product => renderProduct(product))}
            {categoryProducts.length === 0 && (
              <div className="py-8 text-center text-gray-500">
                No products in this category
              </div>
            )}
          </div>
        )}

        {/* Nested categories */}
        {isExpanded && category.children && category.children.length > 0 && (
          <div className="pl-8 py-2">
            {category.children.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <Container className="p-8">
        <div className="animate-pulse">Loading...</div>
      </Container>
    )
  }

  // Get uncategorized products
  const uncategorizedProducts = productsByCategory.get(null) || []

  return (
    <Container className="p-0">
      <Toaster />

      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
            ← Back
          </button>
          <Heading level="h1">Manage Products</Heading>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => toast.success("Saved!")}>
            Save
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Render categories with their products */}
        {categories.map(category => renderCategory(category))}

        {/* Uncategorized products */}
        {uncategorizedProducts.length > 0 && (
          <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
            <div className="py-4 px-4 border-b border-gray-200">
              <div className="font-semibold text-lg">Uncategorized</div>
              <div className="text-sm text-gray-500">{uncategorizedProducts.length} products</div>
            </div>
            {uncategorizedProducts.map(product => renderProduct(product))}
          </div>
        )}

        {/* Empty state */}
        {categories.length === 0 && assignedProducts.length === 0 && (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <Heading level="h3" className="text-gray-600">No products assigned</Heading>
            <p className="text-gray-500 mt-2">Add products from the catalog to this location.</p>
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Manage Products",
})

export default ManageProductsPage
