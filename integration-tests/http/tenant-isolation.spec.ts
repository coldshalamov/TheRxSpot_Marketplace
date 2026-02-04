import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Tenant Isolation", () => {
      let businessA: any
      let businessB: any

      beforeAll(async () => {
        // Create two test businesses
        const resA = await api.post("/admin/businesses", {
          name: "Tenant A",
          slug: "tenant-a",
          domain: "tenant-a.test",
          primary_color: "#ff0000",
          status: "active",
          is_active: true,
        })
        businessA = resA.data.business

        const resB = await api.post("/admin/businesses", {
          name: "Tenant B",
          slug: "tenant-b",
          domain: "tenant-b.test",
          primary_color: "#0000ff",
          status: "active",
          is_active: true,
        })
        businessB = resB.data.business
      })

      it("should resolve business from x-business-slug header", async () => {
        const res = await api.get("/store/tenant-config", {
          headers: { "x-business-slug": "tenant-a" },
        })
        expect(res.status).toBe(200)
        expect(res.data.business.slug).toBe("tenant-a")
      })

      it("should return 404 for unknown host", async () => {
        const res = await api
          .get("/store/tenant-config", {
            headers: { host: "unknown-domain.test" },
          })
          .catch((e) => e.response)

        expect(res.status).toBe(404)
      })

      it("should return 404 for suspended business", async () => {
        // Suspend tenant B
        await api.post(`/admin/businesses/${businessB.id}/status`, {
          status: "suspended",
        })

        // Try to access suspended tenant via slug
        const res = await api
          .get("/store/businesses", {
            headers: { "x-business-slug": "tenant-b" },
          })
          .catch((e) => e.response)

        // Suspended businesses get 404 from tenant resolution middleware
        expect(res.status).toBe(404)

        // Reactivate for other tests
        await api.post(`/admin/businesses/${businessB.id}/status`, {
          status: "active",
        })
      })

      it("should list businesses by status filter", async () => {
        const res = await api.get("/admin/businesses?status=active")
        expect(res.status).toBe(200)
        expect(res.data.businesses.length).toBeGreaterThanOrEqual(1)
        for (const b of res.data.businesses) {
          expect(b.status).toBe("active")
        }
      })
    })
  },
})
