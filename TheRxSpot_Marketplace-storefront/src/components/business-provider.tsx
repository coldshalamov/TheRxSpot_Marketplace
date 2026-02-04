// components/business-provider.tsx
"use client"

import { createContext, useContext, ReactNode, useMemo } from "react"
import { Business, Location } from "@/lib/business"
import { TenantConfig } from "@/lib/tenant"

interface BusinessContextType {
  business: Business
  locations: Location[]
  tenantConfig: TenantConfig | null
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined)

export function BusinessProvider({
  children,
  business,
  locations,
  tenantConfig,
}: {
  children: ReactNode
  business: Business
  locations: Location[]
  tenantConfig?: TenantConfig | null
}) {
  const value = useMemo(
    () => ({ business, locations, tenantConfig: tenantConfig ?? null }),
    [business, locations, tenantConfig]
  )

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  const context = useContext(BusinessContext)
  if (!context) {
    throw new Error("useBusiness must be used within BusinessProvider")
  }
  return context
}
