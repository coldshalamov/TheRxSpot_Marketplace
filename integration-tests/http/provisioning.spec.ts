import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Business Provisioning", () => {
      let business: any

      beforeAll(async () => {
        // Create a test business
        const res = await api.post("/admin/businesses", {
          name: "Provision Test Biz",
          slug: "provision-test",
          primary_color: "#123456",
          is_active: true,
        })
        business = res.data.business
      })

      it("should create business with pending status", () => {
        expect(business.status).toBe("pending")
      })

      it("should transition status from pending to approved", async () => {
        const res = await api.post(
          `/admin/businesses/${business.id}/status`,
          { status: "approved" }
        )
        expect(res.status).toBe(200)
        expect(res.data.business.status).toBe("approved")
      })

      it("should reject invalid status transitions", async () => {
        // Business is now "approved", trying to go to "pending" should fail
        const res = await api
          .post(`/admin/businesses/${business.id}/status`, {
            status: "pending",
          })
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("should provision business with sales channel and API key", async () => {
        const res = await api.post(
          `/admin/businesses/${business.id}/provision`,
          {}
        )

        expect(res.status).toBe(200)
        expect(res.data.business.sales_channel_id).toBeTruthy()
        expect(res.data.business.publishable_api_key_id).toBeTruthy()
        expect(res.data.business.status).toBe("active")
        expect(res.data.business.settings).toBeTruthy()
        expect(res.data.business.settings.storefront_url).toBeTruthy()
        expect(res.data.business.settings.qr_code_data_url).toContain(
          "data:image/png"
        )
        expect(res.data.business.settings.dns_instructions).toBeInstanceOf(
          Array
        )
      })

      it("should generate QR code via endpoint", async () => {
        const res = await api.get(
          `/admin/businesses/${business.id}/qr-code`
        )
        expect(res.status).toBe(200)
        expect(res.data.qr_code_data_url).toContain("data:image/png")
      })

      it("should regenerate QR code via POST", async () => {
        const res = await api.post(
          `/admin/businesses/${business.id}/qr-code`
        )
        expect(res.status).toBe(200)
        expect(res.data.qr_code_data_url).toContain("data:image/png")
      })
    })
  },
})
