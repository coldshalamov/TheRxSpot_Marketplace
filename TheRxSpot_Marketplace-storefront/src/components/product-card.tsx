// components/product-card.tsx
"use client"

import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

interface ProductCardProps {
  product: {
    id: string
    handle?: string
    title: string
    description: string
    thumbnail: string | null
    variants: {
      id: string
      title: string
      prices: { amount: number; currency_code: string }[]
    }[]
    metadata?: {
      starting_price?: number
      requires_consult?: boolean
    }
  }
  businessSlug?: string
}

export function ProductCard({ product }: ProductCardProps) {
  // Get the lowest price from all variants
  const lowestPrice = product.variants.reduce((min, v) => {
    const price = v.prices?.[0]?.amount
    if (!price) return min
    return min === 0 ? price : Math.min(min, price)
  }, 0)

  // Use metadata starting_price if available, otherwise calculated lowest
  const displayPrice = product.metadata?.starting_price
    ? product.metadata.starting_price * 100
    : lowestPrice

  return (
    <LocalizedClientLink href={`/products/${product.handle || product.id}`}>
      <div className="group border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
        {product.thumbnail ? (
          <div className="aspect-square relative">
            <Image
              src={product.thumbnail}
              alt={product.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
            />
          </div>
        ) : (
          <div className="aspect-square bg-gray-100 flex items-center justify-center">
            <span className="text-4xl">💊</span>
          </div>
        )}
        
        <div className="p-4">
          <h3 className="font-semibold text-lg mb-1">{product.title}</h3>
          
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {product.description}
          </p>
          
          {displayPrice > 0 && (
            <p className="font-bold text-lg">
              Starting at ${(displayPrice / 100).toFixed(2)}
            </p>
          )}

          {product.metadata?.requires_consult && (
            <span className="inline-block mt-2 text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded">
              Consult Required
            </span>
          )}
        </div>
      </div>
    </LocalizedClientLink>
  )
}
