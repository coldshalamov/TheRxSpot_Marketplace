/**
 * Tenant Resolution Tests
 *
 * Validates that tenant resolution works with `x-tenant-host` and that platform
 * hostnames are exact-match only (no suffix matching).
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createTestBusiness } from "../utils/factories"

jest.setTimeout(60000)

medusaIntegrationTestRunner({
  env: {
    PLATFORM_HOSTNAMES: "therxspot.com,api.therxspot.com,admin.therxspot.com,localhost,127.0.0.1",
  },
  testSuite: ({ api, getContainer }) => {
    describe("Tenant Resolution", () => {
      let publishableApiKey: string

      beforeEach(async () => {
        const container = getContainer()
        const apiKeyService = container.resolve("api_key") as any

        const key = await apiKeyService.createApiKeys({
          title: "test publishable key (tenant resolution)",
          type: "publishable",
          created_by: "integration_test",
        })

        publishableApiKey = key.token
      })

      it("resolves a tenant domain via x-tenant-host even when PLATFORM_HOSTNAMES includes therxspot.com", async () => {
        const container = getContainer()
        const businessService = container.resolve("businessModuleService") as any

        const business = await createTestBusiness(container, { slug: "best-health" })
        await businessService.createBusinessDomains({
          business_id: business.id,
          domain: "best-health.therxspot.com",
          is_primary: true,
          is_verified: true,
        })

        const res = await api
          .get("/store/tenant-config", {
            headers: {
              "x-publishable-api-key": publishableApiKey,
              "x-tenant-host": "best-health.therxspot.com",
            },
          })
          .catch((e: any) => e.response)

        expect(res.status).toBe(200)
        expect(res.data.business).toMatchObject({
          id: business.id,
          slug: "best-health",
        })
      })

      it("does not resolve tenants for platform hostnames", async () => {
        const res = await api
          .get("/store/tenant-config", {
            headers: {
              "x-publishable-api-key": publishableApiKey,
              "x-tenant-host": "api.therxspot.com",
            },
          })
          .catch((e: any) => e.response)

        expect(res.status).toBe(404)
      })
    })
  },
})

