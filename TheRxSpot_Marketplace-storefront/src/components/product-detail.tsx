// components/product-detail.tsx
"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useBusiness } from "./business-provider"

const MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

interface Product {
  id: string
  title: string
  description: string
  thumbnail: string
  images: { url: string }[]
  variants: {
    id: string
    title: string
    prices: { amount: number; currency_code: string }[]
  }[]
  requires_consult?: boolean
}

interface ProductDetailProps {
  businessSlug: string
  productId: string
}

export function ProductDetail({ businessSlug, productId }: ProductDetailProps) {
  const { business } = useBusiness()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVariant, setSelectedVariant] = useState<string>("")
  
  useEffect(() => {
    fetchProduct()
  }, [productId])
  
  const fetchProduct = async () => {
    try {
      const res = await fetch(
        `${MEDUSA_BACKEND_URL}/store/products/${productId}?business=${businessSlug}`
      )
      if (!res.ok) throw new Error("Failed to fetch product")
      
      const data = await res.json()
      setProduct(data.product)
      if (data.product.variants.length > 0) {
        setSelectedVariant(data.product.variants[0].id)
      }
    } catch (error) {
      console.error("Error fetching product:", error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleAddToCart = () => {
    // Add to cart logic here
    console.log("Adding to cart:", selectedVariant)
  }
  
  if (loading) {
    return <div>Loading product...</div>
  }
  
  if (!product) {
    return <div>Product not found.</div>
  }
  
  const selectedVariantData = product.variants.find(v => v.id === selectedVariant)
  const price = selectedVariantData?.prices[0]
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        {product.thumbnail ? (
          <div className="aspect-square relative rounded-lg overflow-hidden">
            <Image
              src={product.thumbnail}
              alt={product.title}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
            <span className="text-6xl">💊</span>
          </div>
        )}
      </div>
      
      <div>
        <h1 className="text-3xl font-bold mb-4">{product.title}</h1>
        
        <div 
          className="prose mb-6"
          dangerouslySetInnerHTML={{ __html: product.description }}
        />
        
        {product.variants.length > 1 && (
          <div className="mb-6">
            <label className="block font-semibold mb-2">Select Dosage:</label>
            <select
              value={selectedVariant}
              onChange={(e) => setSelectedVariant(e.target.value)}
              className="w-full p-2 border rounded"
            >
              {product.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.title}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {price && (
          <div className="mb-6">
            <p className="text-2xl font-bold">
              ${(price.amount / 100).toFixed(2)} {price.currency_code.toUpperCase()}
            </p>
          </div>
        )}
        
        
        <button
          onClick={handleAddToCart}
          className="w-full py-3 px-6 rounded-lg font-semibold text-white"
          style={{
            backgroundColor: business.primary_color || "#0f766e",
          }}
        >
          Add to Cart
        </button>
      </div>
      
    </div>
  )
}
