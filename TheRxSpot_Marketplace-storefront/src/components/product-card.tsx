// components/product-card.tsx
"use client"

import Link from "next/link"
import Image from "next/image"

interface ProductCardProps {
  product: {
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
  businessSlug: string
}

export function ProductCard({ product, businessSlug }: ProductCardProps) {
  const price = product.variants[0]?.prices[0]
  
  return (
    <Link href={`/${businessSlug}/products/${product.id}`}>
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
          
          {price && (
            <p className="font-bold text-lg">
              ${(price.amount / 100).toFixed(2)} {price.currency_code.toUpperCase()}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
