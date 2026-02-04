import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Admin Tenant Scoping", () => {
      let businessA: any
      let businessB: any

      beforeAll(async () => {
        // Create two businesses with domains
        const resA = await api.post("/admin/businesses", {
          name: "Scoping Test A",
          slug: "scoping-a",
          domain: "scoping-a.test",
          is_active: true,
        })
        businessA = resA.data.business

        const resB = await api.post("/admin/businesses", {
          name: "Scoping Test B",
          slug: "scoping-b",
          domain: "scoping-b.test",
          is_active: true,
        })
        businessB = resB.data.business
      })

      it("should manage domains for a business", async () => {
        // Add domain
        const addRes = await api.post(
          `/admin/businesses/${businessA.id}/domains`,
          {
            domain: "custom-a.test",
            is_primary: true,
          }
        )
        expect(addRes.status).toBe(201)
        expect(addRes.data.domain.domain).toBe("custom-a.test")

        // List domains
        const listRes = await api.get(
          `/admin/businesses/${businessA.id}/domains`
        )
        expect(listRes.status).toBe(200)
        expect(listRes.data.domains.length).toBeGreaterThanOrEqual(1)

        // Delete domain
        const domainId = addRes.data.domain.id
        const delRes = await api.delete(
          `/admin/businesses/${businessA.id}/domains/${domainId}`
        )
        expect(delRes.status).toBe(204)
      })

      it("should create and list business users", async () => {
        const container = getContainer()
        const businessModuleService = container.resolve(
          "businessModuleService"
        )

        // Create user for business A
        await businessModuleService.createBusinessUsers({
          business_id: businessA.id,
          email: "user-a@test.com",
          role: "owner",
          is_active: true,
        })

        // Create user for business B
        await businessModuleService.createBusinessUsers({
          business_id: businessB.id,
          email: "user-b@test.com",
          role: "owner",
          is_active: true,
        })

        // List users for business A
        const usersA = await businessModuleService.listBusinessUsers({
          business_id: businessA.id,
        })
        expect(usersA.length).toBeGreaterThanOrEqual(1)
        expect(usersA.every((u: any) => u.business_id === businessA.id)).toBe(
          true
        )

        // List users for business B
        const usersB = await businessModuleService.listBusinessUsers({
          business_id: businessB.id,
        })
        expect(usersB.length).toBeGreaterThanOrEqual(1)
        expect(usersB.every((u: any) => u.business_id === businessB.id)).toBe(
          true
        )
      })

      it("should retrieve business by status", async () => {
        const container = getContainer()
        const businessModuleService = container.resolve(
          "businessModuleService"
        )

        const pending = await businessModuleService.getBusinessByStatus(
          "pending"
        )
        for (const b of pending) {
          expect(b.status).toBe("pending")
        }
      })

      it("should resolve business by domain from table", async () => {
        const container = getContainer()
        const businessModuleService = container.resolve(
          "businessModuleService"
        )

        // Add a domain to business A
        await businessModuleService.createBusinessDomains({
          business_id: businessA.id,
          domain: "domain-test-a.test",
          is_primary: true,
          is_verified: true,
          verified_at: new Date(),
        })

        const resolved =
          await businessModuleService.getBusinessByDomainFromTable(
            "domain-test-a.test"
          )
        expect(resolved).toBeTruthy()
        expect(resolved.id).toBe(businessA.id)

        // Unknown domain
        const notFound =
          await businessModuleService.getBusinessByDomainFromTable(
            "nonexistent.test"
          )
        expect(notFound).toBeNull()
      })
    })
  },
})
