import {
  createWorkflow,
  WorkflowResponse,
  transform,
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createSalesChannelsWorkflow,
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../modules/business"
import QRCode from "qrcode"

type ProvisionInput = {
  business_id: string
  storefront_base_url?: string
}

const getBusinessStep = createStep(
  "get-business",
  async (input: ProvisionInput, { container }) => {
    const businessService = container.resolve(BUSINESS_MODULE)
    const business = await businessService.retrieveBusiness(input.business_id)
    return new StepResponse(business)
  }
)

const createDefaultTemplateStep = createStep(
  "create-default-template",
  async (input: { business_id: string }, { container }) => {
    const businessService = container.resolve(BUSINESS_MODULE)
    const template = await businessService.createDefaultTemplate(input.business_id)
    return new StepResponse(template)
  }
)

const updateBusinessAfterProvisionStep = createStep(
  "update-business-after-provision",
  async (
    input: {
      business_id: string
      sales_channel_id: string
      publishable_api_key_id: string
      publishable_api_key_token: string
      storefront_base_url: string
      business_slug: string
    },
    { container }
  ) => {
    const businessService = container.resolve(BUSINESS_MODULE)

    const storefrontUrl = `${input.storefront_base_url}`

    let qrCodeDataUrl: string | null = null
    try {
      qrCodeDataUrl = await QRCode.toDataURL(storefrontUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      })
    } catch {
      // QR generation failure is non-critical
    }

    const dnsInstructions = [
      `Add a CNAME record pointing your custom domain to your storefront host.`,
      `Example: yourdomain.com -> CNAME -> your-storefront-host.com`,
      `After DNS propagation, the storefront will automatically resolve your tenant.`,
    ]

    const settings = {
      storefront_url: storefrontUrl,
      qr_code_data_url: qrCodeDataUrl,
      dns_instructions: dnsInstructions,
      publishable_api_key_token: input.publishable_api_key_token,
    }

    const [updated] = await businessService.updateBusinesses({
      selector: { id: input.business_id },
      data: {
        sales_channel_id: input.sales_channel_id,
        publishable_api_key_id: input.publishable_api_key_id,
        status: "active",
        settings,
      },
    })

    return new StepResponse(updated)
  }
)

export const provisionBusinessWorkflow = createWorkflow(
  "provision-business",
  (input: ProvisionInput) => {
    const business = getBusinessStep(input)

    const salesChannelName = transform({ business }, (data) => {
      return `SC: ${data.business.name}`
    })

    const salesChannels = createSalesChannelsWorkflow.runAsStep({
      input: {
        salesChannelsData: [{ name: salesChannelName }],
      },
    })

    const salesChannelId = transform({ salesChannels }, (data) => {
      return data.salesChannels[0].id
    })

    const apiKeyTitle = transform({ business }, (data) => {
      return `PK: ${data.business.name}`
    })

    const apiKeys = createApiKeysWorkflow.runAsStep({
      input: {
        api_keys: [
          {
            title: apiKeyTitle,
            type: "publishable",
            created_by: "",
          },
        ],
      },
    })

    const apiKeyId = transform({ apiKeys }, (data) => {
      return data.apiKeys[0].id
    })

    const apiKeyToken = transform({ apiKeys }, (data) => {
      return data.apiKeys[0].token
    })

    linkSalesChannelsToApiKeyWorkflow.runAsStep({
      input: {
        id: apiKeyId,
        add: [salesChannelId],
      },
    })

    const storefrontBaseUrl = transform({ input }, (data) => {
      return data.input.storefront_base_url || "http://localhost:8000"
    })

    // Phase 1: Auto-create default template during provisioning
    createDefaultTemplateStep({
      business_id: transform({ business }, (d) => d.business.id),
    })

    const updatedBusiness = updateBusinessAfterProvisionStep({
      business_id: transform({ business }, (d) => d.business.id),
      sales_channel_id: salesChannelId,
      publishable_api_key_id: apiKeyId,
      publishable_api_key_token: apiKeyToken,
      storefront_base_url: storefrontBaseUrl,
      business_slug: transform({ business }, (d) => d.business.slug),
    })

    return new WorkflowResponse(updatedBusiness)
  }
)
