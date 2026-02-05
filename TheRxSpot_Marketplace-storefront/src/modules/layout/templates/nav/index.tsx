"use client"

import { useBusiness } from "@/components/business-provider"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SideMenuWrapper from "./side-menu-wrapper"
import Image from "next/image"

export default function Nav() {
  let business = null
  let tenantConfig = null

  try {
    const context = useBusiness()
    business = context.business
    tenantConfig = context.tenantConfig
  } catch (e) {
    // Not in tenant context, use defaults
  }

  const displayName = business?.name || "Medusa Store"
  const logoUrl = tenantConfig?.branding?.logo_url || business?.logo_url
  const tagline = business?.tagline

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      <header className="relative h-16 mx-auto border-b duration-200 bg-white border-ui-border-base">
        <nav className="content-container txt-xsmall-plus text-ui-fg-subtle flex items-center justify-between w-full h-full text-small-regular">
          <div className="flex-1 basis-0 h-full flex items-center">
            <div className="h-full">
              <SideMenuWrapper />
            </div>
          </div>

          <div className="flex items-center gap-3 h-full">
            <LocalizedClientLink
              href="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              data-testid="nav-store-link"
            >
              {logoUrl && (
                <Image
                  src={logoUrl}
                  alt={displayName}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              )}
              <div className="flex flex-col">
                <span className="txt-compact-xlarge-plus uppercase">
                  {displayName}
                </span>
                {tagline && (
                  <span className="txt-xsmall text-ui-fg-muted">
                    {tagline}
                  </span>
                )}
              </div>
            </LocalizedClientLink>
          </div>

          <div className="flex items-center gap-x-6 h-full flex-1 basis-0 justify-end">
            <div className="hidden small:flex items-center gap-x-6 h-full">
              <LocalizedClientLink
                className="hover:text-ui-fg-base"
                href="/account"
                data-testid="nav-account-link"
              >
                Account
              </LocalizedClientLink>
            </div>
          </div>
        </nav>
      </header>
    </div>
  )
}
