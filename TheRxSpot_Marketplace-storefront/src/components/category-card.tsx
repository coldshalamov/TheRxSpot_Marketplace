// components/category-card.tsx
"use client"

import Link from "next/link"
import Image from "next/image"
import { ProductCategory } from "@/lib/business"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

interface CategoryCardProps {
  category: ProductCategory
  businessSlug: string
}

export function CategoryCard({ category, businessSlug }: CategoryCardProps) {
  return (
    <LocalizedClientLink href={`/categories/${category.id}`}>
      <div className="group card-elegant cursor-pointer h-full">
        {/* Image Container with Overlay */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {category.image_url ? (
            <>
              <Image
                src={category.image_url}
                alt={category.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-70 group-hover:opacity-50 transition-opacity duration-500" />
            </>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)",
              }}
            >
              <span className="text-7xl opacity-80">🏥</span>
            </div>
          )}

          {/* Floating Badge */}
          {category.requires_consult && (
            <div
              className="absolute top-4 right-4 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/30 text-xs font-semibold"
              style={{
                background: "rgba(226, 125, 96, 0.9)",
                color: "white",
              }}
            >
              Consult Required
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          <h3
            className="font-display text-2xl font-bold group-hover:text-[var(--color-primary)] transition-colors duration-300"
            style={{
              color: "var(--color-text-primary)",
            }}
          >
            {category.name}
          </h3>

          {category.description && (
            <p
              className="text-sm leading-relaxed line-clamp-2"
              style={{
                color: "var(--color-text-secondary)",
              }}
            >
              {category.description}
            </p>
          )}

          {/* View Details Link */}
          <div className="pt-2 flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all duration-300"
            style={{ color: "var(--color-primary)" }}
          >
            <span>View Treatments</span>
            <svg
              className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
