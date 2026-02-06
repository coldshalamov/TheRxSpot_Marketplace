import { ExecArgs, ISalesChannelModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function ensureStorefrontPublishableKey({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const salesChannelModuleService: ISalesChannelModuleService = container.resolve(
    Modules.SALES_CHANNEL
  )

  const defaultSalesChannels = await salesChannelModuleService.listSalesChannels(
    { name: "Default Sales Channel" },
    { take: 1 }
  )

  if (!defaultSalesChannels.length) {
    throw new Error(
      "Default Sales Channel not found. Run `npm run seed` first to initialize store data."
    )
  }

  const {
    result: [publishableApiKeyResult],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: `Local Storefront Dev Key ${new Date().toISOString()}`,
          type: "publishable",
          created_by: "",
        },
      ],
    },
  })

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKeyResult.id,
      add: [defaultSalesChannels[0].id],
    },
  })

  const token = (publishableApiKeyResult as any)?.token
  if (!token || typeof token !== "string") {
    throw new Error("Failed to create publishable API key token.")
  }

  logger.info("Created and linked local storefront publishable key.")
  // Machine-readable output for launcher parsing.
  console.log(`PUBLISHABLE_KEY=${token}`)
}
