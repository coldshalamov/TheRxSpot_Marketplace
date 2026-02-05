/**
 * Seed script to create The Rx Spot business with the full product catalog.
 *
 * Run with: npm run seed:therxspot (add script to package.json)
 * Or: npx medusa exec ./src/scripts/seed-the-rx-spot.ts
 */

import {
  ExecArgs,
  IProductModuleService,
  IRegionModuleService,
  ISalesChannelModuleService,
} from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import catalogData from "../../seed-data/the-rx-spot-catalog.json"

export default async function seedTheRxSpot({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productService: IProductModuleService = container.resolve(Modules.PRODUCT)
  const regionService: IRegionModuleService = container.resolve(Modules.REGION)
  const salesChannelService: ISalesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const businessService = container.resolve("businessModuleService")

  logger.info("Starting The Rx Spot seed...")

  // 1. Create or get The Rx Spot business
  let business: any
  const existingBusinesses = await businessService.listBusinesses({ slug: "the-rx-spot" }, { take: 1 })

  if (existingBusinesses.length > 0) {
    business = existingBusinesses[0]
    logger.info(`Using existing business: ${business.name} (${business.id})`)
  } else {
    business = await businessService.createBusinesses({
      name: "The Rx Spot",
      slug: "the-rx-spot",
      status: "active",
      is_active: true,
      branding_config: {
        logo_url: null,
        primary_color: "#2A4B5C",
        secondary_color: "#00B4A0",
      },
    })
    logger.info(`Created business: ${business.name} (${business.id})`)
  }

  // 2. Get or create sales channel
  let salesChannel: any
  const existingChannels = await salesChannelService.listSalesChannels({ name: "The Rx Spot Store" }, { take: 1 })

  if (existingChannels.length > 0) {
    salesChannel = existingChannels[0]
  } else {
    salesChannel = await salesChannelService.createSalesChannels({
      name: "The Rx Spot Store",
      description: "The Rx Spot telehealth storefront",
      is_disabled: false,
    })
    logger.info(`Created sales channel: ${salesChannel.name}`)
  }

  // 3. Get or create default region
  let region: any
  const existingRegions = await regionService.listRegions({ name: "United States" }, { take: 1 })

  if (existingRegions.length > 0) {
    region = existingRegions[0]
  } else {
    region = await regionService.createRegions({
      name: "United States",
      currency_code: "usd",
      countries: ["us"],
    })
    logger.info(`Created region: ${region.name}`)
  }

  // 4. Create product categories
  logger.info("Creating categories...")
  const categoryMap = new Map<string, string>()

  for (const categoryData of catalogData.categories) {
    const existingCategories = await businessService.listProductCategories(
      { business_id: business.id, name: categoryData.name },
      { take: 1 }
    )

    let category: any
    if (existingCategories.length > 0) {
      category = existingCategories[0]
      logger.info(`Using existing category: ${category.name}`)
    } else {
      category = await businessService.createProductCategories({
        business_id: business.id,
        name: categoryData.name,
        rank: categoryData.rank,
        is_active: true,
        requires_consult: true, // All telehealth products require consultation
      })
      logger.info(`Created category: ${category.name}`)
    }

    categoryMap.set(categoryData.name, category.id)
  }

  // 5. Create products and variants
  logger.info("Creating products...")
  let productCount = 0
  let variantCount = 0

  for (const categoryData of catalogData.categories) {
    const categoryId = categoryMap.get(categoryData.name)

    for (const productData of categoryData.products) {
      // Check if product exists
      const existingProducts = await productService.listProducts(
        { title: productData.name },
        { take: 1 }
      )

      if (existingProducts.length > 0) {
        logger.info(`Product already exists: ${productData.name}`)
        continue
      }

      // Create product with variants
      const variantData = productData.variants.map((v, index) => ({
        title: `${v.form} - ${v.dosage}`,
        sku: `${productData.name.replace(/\s+/g, "-").toLowerCase()}-${v.form.toLowerCase()}-${v.dosage.toLowerCase()}-${index}`,
        manage_inventory: false,
        prices: [
          {
            amount: Math.round(v.sellingPrice * 100), // Convert to cents
            currency_code: "usd",
          },
        ],
        options: {
          Form: v.form,
          Dosage: v.dosage,
        },
        metadata: {
          description: v.description,
          cost_to_business: v.costToBusiness,
          form: v.form,
          dosage: v.dosage,
        },
      }))

      try {
        const product = await productService.createProducts({
          title: productData.name,
          description: productData.variants[0]?.description || "",
          status: productData.status === "active" ? "published" : "draft",
          is_giftcard: false,
          discountable: true,
          options: [
            { title: "Form", values: [...new Set(productData.variants.map(v => v.form))] },
            { title: "Dosage", values: [...new Set(productData.variants.map(v => v.dosage))] },
          ],
          variants: variantData,
          metadata: {
            category_id: categoryId,
            starting_price: productData.startingPrice,
            requires_consult: true,
          },
        })

        productCount++
        variantCount += productData.variants.length
        logger.info(`Created product: ${productData.name} with ${productData.variants.length} variants`)
      } catch (error) {
        logger.error(`Failed to create product ${productData.name}:`, error)
      }
    }
  }

  // 6. Create a location for The Rx Spot
  const existingLocations = await businessService.listLocations(
    { business_id: business.id, name: "The Rx Spot - Main" },
    { take: 1 }
  )

  if (existingLocations.length === 0) {
    await businessService.createLocations({
      business_id: business.id,
      name: "The Rx Spot - Main",
      phone: "555-RX-SPOT",
      email: "support@therxspot.com",
      serviceable_states: ["TX", "FL", "CA", "NY", "AZ", "NV"],
      is_active: true,
    })
    logger.info("Created location: The Rx Spot - Main")
  }

  logger.info("=".repeat(50))
  logger.info("Seed completed successfully!")
  logger.info(`Business: ${business.name} (${business.id})`)
  logger.info(`Categories: ${catalogData.categories.length}`)
  logger.info(`Products created: ${productCount}`)
  logger.info(`Variants created: ${variantCount}`)
  logger.info("=".repeat(50))
}
