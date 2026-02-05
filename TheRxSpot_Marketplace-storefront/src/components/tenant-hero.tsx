// components/tenant-hero.tsx
"use client"

import { Business } from "@/lib/business"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

interface TenantHeroProps {
  business: Business
}

export function TenantHero({ business }: TenantHeroProps) {
  const primaryColor = business.primary_color || business.branding_config?.primary_color || "#0B5D5A"
  const accentColor = "#E27D60"

  return (
    <section
      className="relative min-h-[85vh] overflow-hidden medical-pattern"
      style={{
        backgroundColor: "var(--color-cream)",
      }}
    >
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10 animate-float"
        style={{
          background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`,
        }}
      />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10 animate-pulse-soft"
        style={{
          background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
        }}
      />

      {/* Diagonal Accent Strip */}
      <div
        className="absolute top-0 right-0 w-[40%] h-full opacity-5"
        style={{
          background: primaryColor,
          clipPath: "polygon(30% 0, 100% 0, 100% 100%, 0 100%)",
        }}
      />

      <div className="content-container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center min-h-[85vh] py-20">

          {/* Left Content - Asymmetric Positioning */}
          <div className="lg:col-span-7 space-y-8">

            {/* Logo with animation */}
            {business.logo_url && (
              <div className="animate-fade-in-up stagger-1 relative inline-block">
                <div className="absolute inset-0 blur-xl opacity-20"
                  style={{ backgroundColor: primaryColor }}
                />
                <Image
                  src={business.logo_url}
                  alt={business.name}
                  width={220}
                  height={66}
                  className="object-contain relative z-10"
                  priority
                />
              </div>
            )}

            {/* Main Headline */}
            <div className="space-y-6">
              <h1
                className="text-5xl md:text-7xl lg:text-8xl font-display font-bold leading-[1.1] animate-fade-in-up stagger-2"
                style={{
                  color: primaryColor,
                  fontFamily: "var(--font-display)",
                }}
              >
                Professional
                <br />
                <span className="relative inline-block">
                  Telehealth
                  <span
                    className="absolute bottom-2 left-0 w-full h-3 -z-10 opacity-30"
                    style={{ backgroundColor: accentColor }}
                  />
                </span>
                <br />
                Excellence
              </h1>

              <p
                className="text-xl md:text-2xl max-w-xl leading-relaxed animate-fade-in-up stagger-3"
                style={{
                  color: "var(--color-text-secondary)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Experience premium healthcare from the comfort of your home.
                Licensed providers, personalized treatment, delivered with care.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-fade-in-up stagger-4">
              <LocalizedClientLink
                href="/categories"
                className="btn-primary inline-block text-center cursor-pointer"
              >
                Browse Treatments
              </LocalizedClientLink>

              <LocalizedClientLink
                href="/consultations"
                className="btn-secondary inline-block text-center cursor-pointer"
              >
                My Consultations
              </LocalizedClientLink>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap gap-8 pt-8 animate-fade-in-up stagger-5">
              <div className="space-y-1">
                <div className="text-3xl font-display font-bold" style={{ color: primaryColor }}>
                  Licensed
                </div>
                <div className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                  Medical Providers
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-3xl font-display font-bold" style={{ color: primaryColor }}>
                  Secure
                </div>
                <div className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                  HIPAA Compliant
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-3xl font-display font-bold" style={{ color: primaryColor }}>
                  Convenient
                </div>
                <div className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                  Direct to Door
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - Visual Element */}
          <div className="lg:col-span-5 relative animate-fade-in-up stagger-6">
            <div
              className="relative rounded-3xl overflow-hidden card-elegant"
              style={{
                minHeight: "500px",
                background: `linear-gradient(135deg, ${primaryColor}15 0%, ${accentColor}15 100%)`,
              }}
            >
              {/* Decorative Medical Icons */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-8 p-12">
                  <div className="text-8xl opacity-20 animate-pulse-soft">💊</div>
                  <div className="text-6xl opacity-20 animate-float">🩺</div>
                  <div className="text-7xl opacity-20 animate-pulse-soft" style={{ animationDelay: "1s" }}>⚕️</div>
                </div>
              </div>

              {/* Stats Overlay Cards */}
              <div className="absolute bottom-8 left-8 right-8 space-y-4">
                <div
                  className="p-6 rounded-2xl backdrop-blur-md border border-white/20"
                  style={{
                    background: "rgba(255, 255, 255, 0.9)",
                    boxShadow: "var(--shadow-soft)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                        Average Review Time
                      </div>
                      <div className="text-2xl font-display font-bold mt-1" style={{ color: primaryColor }}>
                        &lt; 2 Hours
                      </div>
                    </div>
                    <div className="text-4xl">⚡</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Curve Transition */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24"
        style={{
          background: "var(--color-off-white)",
          clipPath: "polygon(0 50%, 100% 0, 100% 100%, 0 100%)",
        }}
      />
    </section>
  )
}
