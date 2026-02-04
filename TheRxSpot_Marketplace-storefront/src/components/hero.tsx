// components/hero.tsx
"use client"

import { Business } from "@/lib/business"
import Link from "next/link"

interface HeroProps {
  business: Business
}

export function Hero({ business }: HeroProps) {
  return (
    <section 
      className="py-20 px-4 text-center"
      style={{
        backgroundColor: business.primary_color || "#0f766e",
        color: "#ffffff",
      }}
    >
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Welcome to {business.name}
        </h1>
        
        <p className="text-lg md:text-xl mb-8 opacity-90">
          Professional telehealth services. Get the care you need from the comfort of your home.
        </p>
        
        <Link
          href={`/${business.slug}/products`}
          className="inline-block px-8 py-3 rounded-lg font-semibold transition-colors"
          style={{
            backgroundColor: business.secondary_color || "#ffffff",
            color: business.primary_color || "#0f766e",
          }}
        >
          View Treatments
        </Link>
      </div>
    </section>
  )
}
