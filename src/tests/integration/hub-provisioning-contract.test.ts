/**
 * Week 2 Bridge: Hub → Marketplace Provisioning Contract
 *
 * Validates:
 * - strict request schema
 * - HMAC signature validation
 * - idempotency by handle
 * - response contains sales channel + publishable key token
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { sha256HmacHex } from "../../utils/hmac"
import { stableStringify } from "../../utils/stable-json"

jest.setTimeout(60000)

medusaIntegrationTestRunner({
  env: {
    HUB_PROVISIONING_SECRET: "itest_hub_secret_0123456789abcdef0123456789abcdef",
    TENANT_PLATFORM_BASE_DOMAIN: "therxspot.com",
  },
  testSuite: ({ api }) => {
    describe("Hub provisioning contract", () => {
      it("provisions a tenant with valid signature and is idempotent on retry", async () => {
        const secret = process.env.HUB_PROVISIONING_SECRET!
        const tsMs = Date.now()

        const body = {
          schema_version: 1,
          handle: "bridge-itest",
          business_name: "Bridge ITest",
          owner_email: "owner+bridge-itest@therxspot.test",
        }

        const canonical = stableStringify(body)
        const message = `${tsMs}.${canonical}`
        const sig = sha256HmacHex(secret, message)

        const first = await api
          .post("/admin/hub/provision", body, {
            headers: {
              "x-hub-timestamp": String(tsMs),
              "x-hub-signature": `sha256=${sig}`,
            },
          })
          .catch((e: any) => e.response)

        if (![200, 201].includes(first.status)) {
          throw new Error(
            `Unexpected response (${first.status}): ${JSON.stringify(first.data ?? null).slice(0, 800)}`
          )
        }
        expect(first.data).toHaveProperty("business_id")
        expect(first.data).toHaveProperty("sales_channel_id")
        expect(first.data).toHaveProperty("publishable_api_key_token")
        expect(typeof first.data.publishable_api_key_token).toBe("string")
        expect(first.data.publishable_api_key_token.length).toBeGreaterThan(10)
        expect(first.data.storefront_url).toContain("bridge-itest.therxspot.com")

        const secondTs = Date.now()
        const secondMsg = `${secondTs}.${canonical}`
        const secondSig = sha256HmacHex(secret, secondMsg)

        const second = await api
          .post("/admin/hub/provision", body, {
            headers: {
              "x-hub-timestamp": String(secondTs),
              "x-hub-signature": `sha256=${secondSig}`,
            },
          })
          .catch((e: any) => e.response)

        expect(second.status).toBe(200)
        expect(second.data.idempotent).toBe(true)
        expect(second.data.business_id).toBe(first.data.business_id)
      })
    })
  },
})
