// components/category-card.tsx
"use client"

import Link from "next/link"
import Image from "next/image"
import { ProductCategory } from "@/lib/business"

interface CategoryCardProps {
  category: ProductCategory
  businessSlug: string
}

export function CategoryCard({ category, businessSlug }: CategoryCardProps) {
  return (
    <Link href={`/${businessSlug}/categories/${category.id}`}>
      <div className="group border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
        {category.image_url ? (
          <div className="aspect-video relative">
            <Image
              src={category.image_url}
              alt={category.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
            />
          </div>
        ) : (
          <div className="aspect-video bg-gray-100 flex items-center justify-center">
            <span className="text-4xl">🏥</span>
          </div>
        )}
        
        <div className="p-4">
          <h3 className="font-semibold text-lg mb-1">{category.name}</h3>
          
          {category.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{category.description}</p>
          )}
          
          {category.requires_consult && (
            <span className="inline-block mt-2 text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded">
              Consult Required
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
