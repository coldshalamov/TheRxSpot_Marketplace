import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"
import { cookies } from "next/headers"
import { getTenantConfigFromCookie } from "@lib/tenant"
import GlobalToaster from "@/components/global-toaster"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get("_tenant_config")?.value
  const tenantConfig = getTenantConfigFromCookie(tenantCookie)

  const branding = tenantConfig?.branding
  const cssVars = branding
    ? `
    :root {
      --tenant-primary: ${branding.primary_color || "#000000"};
      --tenant-secondary: ${branding.secondary_color || "#ffffff"};
      --tenant-accent: ${branding.accent_color || branding.primary_color || "#000000"};
      --tenant-font-family: ${branding.font_family || "Inter, sans-serif"};
    }
  `
    : ""

  return (
    <html lang="en" data-mode="light">
      <head>{cssVars && <style dangerouslySetInnerHTML={{ __html: cssVars }} />}</head>
      <body>
        <main className="relative">{props.children}</main>
        <GlobalToaster />
      </body>
    </html>
  )
}
