import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createSalesChannelsWorkflow,
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"
import { BUSINESS_MODULE } from "../modules/business"
import QRCode from "qrcode"

interface TenantSeedConfig {
  name: string
  slug: string
  primary_color: string
  secondary_color: string
  domain: string
  owner_email: string
}

const TENANTS: TenantSeedConfig[] = [
  {
    name: "HealthFirst Pharmacy",
    slug: "healthfirst",
    primary_color: "#0f766e",
    secondary_color: "#ccfbf1",
    domain: "healthfirst.local",
    owner_email: "admin@healthfirst.com",
  },
  {
    name: "MedDirect Online",
    slug: "meddirect",
    primary_color: "#1e40af",
    secondary_color: "#dbeafe",
    domain: "meddirect.local",
    owner_email: "admin@meddirect.com",
  },
  {
    name: "CarePoint Telehealth",
    slug: "carepoint",
    primary_color: "#7c3aed",
    secondary_color: "#ede9fe",
    domain: "carepoint.local",
    owner_email: "admin@carepoint.com",
  },
]

export default async function seedTenants({ container }: any) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const businessModuleService = container.resolve(BUSINESS_MODULE)
  const storeModuleService = container.resolve(Modules.STORE)

  // Get default stock location
  const [store] = await storeModuleService.listStores()
  const defaultLocationId = store.default_location_id

  if (!defaultLocationId) {
    logger.warn("No default stock location found. Run base seed first.")
    return
  }

  logger.info("Seeding tenant businesses...")

  for (const tenant of TENANTS) {
    // Check if already exists
    const existing = await businessModuleService.getBusinessBySlug(tenant.slug)
    if (existing) {
      logger.info(`Tenant "${tenant.name}" already exists, skipping.`)
      continue
    }

    // Create business
    const business = await businessModuleService.createBusiness({
      name: tenant.name,
      slug: tenant.slug,
      primary_color: tenant.primary_color,
      secondary_color: tenant.secondary_color,
      domain: tenant.domain,
      is_active: true,
      status: "approved",
      branding_config: {
        accent_color: tenant.primary_color,
        font_family: "Inter, sans-serif",
      },
      domain_config: {
        primary_domain: tenant.domain,
        allowed_domains: [tenant.domain],
      },
      catalog_config: {},
      settings: {},
    })

    logger.info(`Created business: ${tenant.name} (${business.id})`)

    // Create BusinessDomain record
    await businessModuleService.createBusinessDomains({
      business_id: business.id,
      domain: tenant.domain,
      is_primary: true,
      is_verified: true,
      verified_at: new Date(),
    })

    // Create BusinessUser (owner)
    await businessModuleService.createBusinessUsers({
      business_id: business.id,
      email: tenant.owner_email,
      role: "owner",
      is_active: true,
    })

    // Provision: Sales Channel
    const { result: salesChannels } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: `SC: ${tenant.name}` }],
      },
    })
    const salesChannelId = salesChannels[0].id

    // Provision: Publishable API Key
    const {
      result: [apiKey],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: `PK: ${tenant.name}`,
            type: "publishable",
            created_by: "",
          },
        ],
      },
    })

    // Link SC to API Key
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: apiKey.id,
        add: [salesChannelId],
      },
    })

    // Link SC to Stock Location
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: defaultLocationId,
        add: [salesChannelId],
      },
    })

    // Generate QR code
    const storefrontUrl = `http://${tenant.domain}:8000`
    let qrCodeDataUrl: string | null = null
    try {
      qrCodeDataUrl = await QRCode.toDataURL(storefrontUrl, {
        width: 300,
        margin: 2,
      })
    } catch {
      // non-critical
    }

    // Update business with provisioning data
    await businessModuleService.updateBusinesses({
      selector: { id: business.id },
      data: {
        sales_channel_id: salesChannelId,
        publishable_api_key_id: apiKey.id,
        status: "active",
        settings: {
          storefront_url: storefrontUrl,
          qr_code_data_url: qrCodeDataUrl,
          publishable_api_key_token: (apiKey as any).token,
          dns_instructions: [
            `Add a CNAME record: ${tenant.domain} -> your-storefront-host`,
            `For local testing, add to hosts file: 127.0.0.1 ${tenant.domain}`,
          ],
        },
      },
    })

    logger.info(
      `Provisioned tenant "${tenant.name}": SC=${salesChannelId}, PK=${apiKey.id}`
    )
  }

  logger.info("Finished seeding tenant businesses.")
}
