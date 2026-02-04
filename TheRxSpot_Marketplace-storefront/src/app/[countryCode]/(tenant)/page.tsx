import { Metadata } from "next"
import { cookies } from "next/headers"

import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { getTenantConfigFromCookie } from "@lib/tenant"
import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get("_tenant_config")?.value
  const tenantConfig = getTenantConfigFromCookie(tenantCookie)

  if (tenantConfig?.business?.name) {
    return {
      title: `${tenantConfig.business.name} | Store`,
      description: `Welcome to ${tenantConfig.business.name}`,
    }
  }

  return {
    title: "Store",
    description: "A performant frontend ecommerce starter template.",
  }
}

export default async function TenantHome(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Hero />
      <div className="py-12">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
    </>
  )
}
