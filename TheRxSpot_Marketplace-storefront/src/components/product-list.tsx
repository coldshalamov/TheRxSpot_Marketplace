// components/product-list.tsx
"use client"

import { useEffect, useState } from "react"
import { ProductCard } from "./product-card"

const MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

interface Product {
  id: string
  title: string
  description: string
  thumbnail: string
  variants: {
    id: string
    title: string
    prices: { amount: number; currency_code: string }[]
  }[]
}

interface ProductListProps {
  businessSlug: string
  categoryId?: string
}

export function ProductList({ businessSlug, categoryId }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchProducts()
  }, [businessSlug, categoryId])
  
  const fetchProducts = async () => {
    try {
      // Fetch products from Medusa with business context
      const url = new URL(`${MEDUSA_BACKEND_URL}/store/products`)
      url.searchParams.append("business", businessSlug)
      if (categoryId) {
        url.searchParams.append("category_id", categoryId)
      }
      
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error("Failed to fetch products")
      
      const data = await res.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return <div>Loading products...</div>
  }
  
  if (products.length === 0) {
    return <div className="text-center py-12">No products available.</div>
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <ProductCard 
          key={product.id} 
          product={product} 
          businessSlug={businessSlug}
        />
      ))}
    </div>
  )
}
