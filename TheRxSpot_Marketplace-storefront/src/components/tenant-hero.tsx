// components/tenant-hero.tsx
"use client"

import { Business } from "@/lib/business"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

interface TenantHeroProps {
  business: Business
}

export function TenantHero({ business }: TenantHeroProps) {
  const primaryColor = business.primary_color || business.branding_config?.primary_color || "#0f766e"
  const secondaryColor = business.secondary_color || business.branding_config?.secondary_color || "#ffffff"

  return (
    <section
      className="py-20 px-4"
      style={{
        backgroundColor: primaryColor,
        color: "#ffffff",
      }}
    >
      <div className="max-w-4xl mx-auto text-center">
        {business.logo_url && (
          <div className="mb-6 flex justify-center">
            <Image
              src={business.logo_url}
              alt={business.name}
              width={200}
              height={60}
              className="object-contain"
            />
          </div>
        )}

        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Welcome to {business.name}
        </h1>

        <p className="text-lg md:text-xl mb-8 opacity-90 max-w-2xl mx-auto">
          Professional telehealth services. Get the care you need from the comfort of your home.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <LocalizedClientLink
            href="/categories"
            className="inline-block px-8 py-3 rounded-lg font-semibold transition-colors"
            style={{
              backgroundColor: secondaryColor,
              color: primaryColor,
            }}
          >
            Browse Treatments
          </LocalizedClientLink>

          <LocalizedClientLink
            href="/consultations"
            className="inline-block px-8 py-3 rounded-lg font-semibold transition-colors border-2 border-white/30 hover:bg-white/10"
          >
            My Consultations
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}
