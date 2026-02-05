import { Metadata } from "next"
import { cookies } from "next/headers"

import { listCartOptions, retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getBaseURL } from "@lib/util/env"
import { StoreCartShippingOption } from "@medusajs/types"
import { getTenantConfigFromCookie, TenantConfig } from "@lib/tenant"
import { BusinessProvider } from "@/components/business-provider"
import { resolveBusiness, fetchBusinessLocations } from "@lib/business"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function TenantLayout(props: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get("_tenant_config")?.value
  const tenantConfig = getTenantConfigFromCookie(tenantCookie)

  const customer = await retrieveCustomer()
  const cart = await retrieveCart()
  let shippingOptions: StoreCartShippingOption[] = []

  if (cart) {
    const { shipping_options } = await listCartOptions()
    shippingOptions = shipping_options
  }

  // If we have tenant config, resolve the full business and wrap in provider
  if (tenantConfig?.business?.slug) {
    const business = await resolveBusiness("", tenantConfig.business.slug)
    const locations = business
      ? await fetchBusinessLocations(business.slug)
      : []

    if (business) {
      const branding = tenantConfig.branding || {}

      return (
        <BusinessProvider
          business={business}
          locations={locations}
          tenantConfig={tenantConfig}
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `
              :root {
                --tenant-primary: ${branding.primary_color || "#000000"};
                --tenant-secondary: ${branding.secondary_color || "#ffffff"};
                --tenant-accent: ${branding.accent_color || branding.primary_color || "#000000"};
                --tenant-font-family: ${branding.font_family || "Inter, sans-serif"};
              }
            `,
            }}
          />
          {business.custom_tracking_script && (
            <script
              dangerouslySetInnerHTML={{
                __html: business.custom_tracking_script,
              }}
            />
          )}
          <Nav />
          {customer && cart && (
            <CartMismatchBanner customer={customer} cart={cart} />
          )}
          {cart && (
            <FreeShippingPriceNudge
              variant="popup"
              cart={cart}
              shippingOptions={shippingOptions}
            />
          )}
          {props.children}
          <Footer />
        </BusinessProvider>
      )
    }
  }

  // Fallback: no tenant resolved, render standard layout
  return (
    <>
      <Nav />
      {customer && cart && (
        <CartMismatchBanner customer={customer} cart={cart} />
      )}
      {cart && (
        <FreeShippingPriceNudge
          variant="popup"
          cart={cart}
          shippingOptions={shippingOptions}
        />
      )}
      {props.children}
      <Footer />
    </>
  )
}
