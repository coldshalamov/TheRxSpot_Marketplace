/**
 * Users Management APIs + behavior (PLAN Week 3-4)
 *
 * Covers:
 * - GET /admin/users (server-side pagination, filters, search)
 * - POST /admin/users/:id/status (deactivate/reactivate)
 * - GET /admin/users/export (CSV export respects filters)
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import jwt from "jsonwebtoken"
import { Modules } from "@medusajs/framework/utils"
import {
  createTestClinician,
  createTestCustomer,
} from "../utils/factories"

jest.setTimeout(60000)

function signAdminToken(userId: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET must be set for integration tests")
  }

  return jwt.sign(
    {
      actor_id: userId,
      actor_type: "user",
      auth_identity_id: "",
      app_metadata: {},
      user_metadata: {},
    },
    secret
  )
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("Users management (PLAN)", () => {
      it("lists users with pagination + role/status filters", async () => {
        const container = getContainer()

        // Seed customers (30)
        for (let i = 0; i < 30; i++) {
          await createTestCustomer(container, {
            email: `customer_${i}@test.com`,
            first_name: "Test",
            last_name: `Customer${i}`,
            phone: `+1555000${String(i).padStart(4, "0")}`,
            metadata: {
              is_active: true,
              date_of_birth: "1990-01-01",
            },
          })
        }

        // Seed a clinician
        await createTestClinician(container, {
          business_id: null as any,
          first_name: "Dr",
          last_name: "Clinician",
          email: "clinician@test.com",
          phone: "+15551234567",
          status: "active",
          license_number: "LIC-1",
          license_state: "FL",
          license_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          credentials: [],
          specializations: [],
          timezone: "America/New_York",
        } as any)

        // Seed an admin user
        const userService = container.resolve(Modules.USER) as any
        const adminUser = await userService.createUsers({
          email: "admin_user@test.com",
          first_name: "Admin",
          last_name: "User",
          metadata: {
            phone: "+15559876543",
            date_of_birth: "1985-02-01",
            is_active: true,
          },
        })

        const adminToken = signAdminToken(adminUser.id)

        const page1 = await api
          .get(`/admin/custom/users?limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(page1.status).toBe(200)
        expect(page1.data.users).toHaveLength(25)
        expect(page1.data.limit).toBe(25)
        expect(page1.data.offset).toBe(0)
        expect(page1.data.count).toBeGreaterThanOrEqual(31) // 30 customers + 1 clinician (+ admin)

        const page2 = await api
          .get(`/admin/custom/users?limit=25&offset=25`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(page2.status).toBe(200)
        expect(page2.data.users.length).toBeGreaterThan(0)
        expect(page2.data.offset).toBe(25)

        const customersOnly = await api
          .get(`/admin/custom/users?role=customer&limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        if (customersOnly.status !== 200) {
          throw new Error(
            `customersOnly failed: ${customersOnly.status} ${JSON.stringify(customersOnly.data)}`
          )
        }
        expect(customersOnly.status).toBe(200)
        expect(customersOnly.data.users.every((u: any) => u.role === "customer")).toBe(true)
      })

      it("searches by email/phone and deactivates/reactivates users", async () => {
        const container = getContainer()
        const userService = container.resolve(Modules.USER) as any
        const adminUser = await userService.createUsers({
          email: "admin_user_2@test.com",
          first_name: "Admin",
          last_name: "Two",
          metadata: { is_active: true },
        })

        const customer = await createTestCustomer(container, {
          email: "search_target@test.com",
          first_name: "Search",
          last_name: "Target",
          phone: "+15551239999",
          metadata: { is_active: true },
        })

        const adminToken = signAdminToken(adminUser.id)

        const searchRes = await api
          .get(`/admin/custom/users?q=${encodeURIComponent("search_target@test.com")}&limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        expect(searchRes.status).toBe(200)
        expect(searchRes.data.users.some((u: any) => u.email === customer.email)).toBe(true)

        // Deactivate
        const compositeId = searchRes.data.users.find((u: any) => u.email === customer.email)?.id
        expect(typeof compositeId).toBe("string")

        const deactivateRes = await api
          .post(
            `/admin/custom/users/${encodeURIComponent(compositeId)}/status`,
            { status: "inactive", reason: "bulk test" },
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        expect(deactivateRes.status).toBe(200)
        expect(deactivateRes.data.user?.status).toBe("inactive")

        const inactiveRes = await api
          .get(`/admin/custom/users?status=inactive&limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        if (inactiveRes.status !== 200) {
          throw new Error(
            `inactiveRes failed: ${inactiveRes.status} ${JSON.stringify(inactiveRes.data)}`
          )
        }
        expect(inactiveRes.status).toBe(200)
        expect(inactiveRes.data.users.some((u: any) => u.id === compositeId)).toBe(true)

        // Reactivate
        const reactivateRes = await api
          .post(
            `/admin/custom/users/${encodeURIComponent(compositeId)}/status`,
            { status: "active" },
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        expect(reactivateRes.status).toBe(200)
        expect(reactivateRes.data.user?.status).toBe("active")
      })

      it("exports CSV for current filter set", async () => {
        const container = getContainer()
        const userService = container.resolve(Modules.USER) as any
        const adminUser = await userService.createUsers({
          email: "admin_user_3@test.com",
          first_name: "Admin",
          last_name: "Three",
          metadata: { is_active: true },
        })

        await createTestCustomer(container, {
          email: "csv_export@test.com",
          first_name: "CSV",
          last_name: "Export",
          phone: "+15551238888",
          metadata: { is_active: true },
        })

        const adminToken = signAdminToken(adminUser.id)

        const res = await fetch(`${api.defaults.baseURL}/admin/custom/users/export?role=customer&q=${encodeURIComponent("csv_export@test.com")}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })

        expect(res.status).toBe(200)
        expect(res.headers.get("content-type") || "").toContain("text/csv")
        const text = await res.text()
        expect(text).toContain("email")
        expect(text).toContain("csv_export@test.com")
      })

      it("updates user personal info", async () => {
        const container = getContainer()
        const userService = container.resolve(Modules.USER) as any
        const adminUser = await userService.createUsers({
          email: "admin_user_update@test.com",
          first_name: "Admin",
          last_name: "Updater",
          metadata: { is_active: true },
        })

        const customer = await createTestCustomer(container, {
          email: "update_target@test.com",
          first_name: "Old",
          last_name: "Name",
          phone: "+15550001111",
          metadata: { is_active: true },
        })

        const adminToken = signAdminToken(adminUser.id)

        const list = await api
          .get(
            `/admin/custom/users?role=customer&q=${encodeURIComponent(customer.email)}&limit=25&offset=0`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        if (list.status !== 200) {
          throw new Error(`list failed: ${list.status} ${JSON.stringify(list.data)}`)
        }

        const compositeId = list.data.users.find((u: any) => u.email === customer.email)?.id
        expect(compositeId).toBeTruthy()

        const updateRes = await api
          .post(
            `/admin/custom/users/${encodeURIComponent(compositeId)}`,
            {
              first_name: "New",
              last_name: "Name",
              phone: "+15550002222",
              date_of_birth: "1992-03-04",
            },
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        expect(updateRes.status).toBe(200)
        expect(updateRes.data.user?.first_name).toBe("New")
        expect(updateRes.data.user?.last_name).toBe("Name")
        expect(updateRes.data.user?.phone).toBe("+15550002222")
        expect(updateRes.data.user?.date_of_birth).toBe("1992-03-04")

        const listAfter = await api
          .get(
            `/admin/custom/users?role=customer&q=${encodeURIComponent("update_target@test.com")}&limit=25&offset=0`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        if (listAfter.status !== 200) {
          throw new Error(
            `listAfter failed: ${listAfter.status} ${JSON.stringify(listAfter.data)}`
          )
        }

        const updated = listAfter.data.users.find((u: any) => u.email === customer.email)
        expect(updated.first_name).toBe("New")
        expect(updated.phone).toBe("+15550002222")
        expect(updated.date_of_birth).toBe("1992-03-04")
      })

      it("supports bulk deactivate", async () => {
        const container = getContainer()
        const userService = container.resolve(Modules.USER) as any
        const adminUser = await userService.createUsers({
          email: "admin_user_bulk@test.com",
          first_name: "Admin",
          last_name: "Bulk",
          metadata: { is_active: true },
        })

        const c1 = await createTestCustomer(container, {
          email: "bulk_1@test.com",
          first_name: "Bulk",
          last_name: "One",
          metadata: { is_active: true },
        })
        const c2 = await createTestCustomer(container, {
          email: "bulk_2@test.com",
          first_name: "Bulk",
          last_name: "Two",
          metadata: { is_active: true },
        })

        const adminToken = signAdminToken(adminUser.id)

        // First fetch to get composite ids
        const list = await api
          .get(`/admin/custom/users?role=customer&q=${encodeURIComponent("bulk_")}&limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        if (list.status !== 200) {
          throw new Error(`list failed: ${list.status} ${JSON.stringify(list.data)}`)
        }

        const id1 = list.data.users.find((u: any) => u.email === c1.email)?.id
        const id2 = list.data.users.find((u: any) => u.email === c2.email)?.id
        expect(id1).toBeTruthy()
        expect(id2).toBeTruthy()

        const bulkRes = await api
          .post(
            `/admin/custom/users/bulk/status`,
            { ids: [id1, id2], status: "inactive", reason: "bulk deactivation" },
            { headers: { Authorization: `Bearer ${adminToken}` } }
          )
          .catch((e: any) => e.response)

        expect(bulkRes.status).toBe(200)
        expect(bulkRes.data.updated).toBe(2)

        const inactive = await api
          .get(`/admin/custom/users?status=inactive&role=customer&limit=25&offset=0`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .catch((e: any) => e.response)

        if (inactive.status !== 200) {
          throw new Error(
            `inactive failed: ${inactive.status} ${JSON.stringify(inactive.data)}`
          )
        }

        const emails = (inactive.data.users || []).map((u: any) => u.email)
        expect(emails).toContain(c1.email)
        expect(emails).toContain(c2.email)
      })
    })
  },
})
