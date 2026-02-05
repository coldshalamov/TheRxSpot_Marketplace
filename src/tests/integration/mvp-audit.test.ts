/**
 * MVP Audit Logging Smoke Tests
 *
 * Keeps CI gating focused on the MVP contract:
 * - audit logs can be written and queried.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

jest.setTimeout(60000)

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("MVP Audit Logging", () => {
      it("writes and queries an audit log entry", async () => {
        const container = getContainer()
        const compliance = container.resolve("complianceModuleService") as any

        const created = await compliance.logAuditEvent({
          actor_type: "system",
          actor_id: "mvp-audit-test",
          actor_email: null,
          action: "read",
          entity_type: "consultation",
          entity_id: "consult_test_001",
          business_id: null,
          consultation_id: "consult_test_001",
          order_id: null,
          changes: null,
          metadata: { test: true },
          risk_level: "low",
          flagged: false,
        })

        expect(created).toHaveProperty("id")

        const [logs] = await compliance.listAndCountAuditLogs(
          { entity_type: "consultation", entity_id: "consult_test_001" },
          { take: 10, order: { created_at: "DESC" } }
        )

        expect(Array.isArray(logs)).toBe(true)
        expect(logs.length).toBeGreaterThan(0)
        expect(logs[0]).toMatchObject({
          action: "read",
          entity_type: "consultation",
          entity_id: "consult_test_001",
        })
      })
    })
  },
})

