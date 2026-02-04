import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CONSULTATION_MODULE } from "../../../../../../modules/consultation"

type UserRole = "customer" | "admin" | "clinician"
type UserStatus = "active" | "inactive"

function parseCompositeId(value: string): { role: UserRole; entityId: string } | null {
  const raw = (value || "").trim()
  const idx = raw.indexOf("__")
  if (idx <= 0) return null
  const role = raw.slice(0, idx) as UserRole
  const entityId = raw.slice(idx + 2)

  if (!entityId) return null
  if (!["customer", "admin", "clinician"].includes(role)) return null
  return { role, entityId }
}

function inferStatusFromMetadata(meta: any): UserStatus {
  if (meta && typeof meta.is_active === "boolean") {
    return meta.is_active ? "active" : "inactive"
  }
  return "active"
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as Record<string, any>
  const ids = Array.isArray(body.ids) ? body.ids : []
  const status = (typeof body.status === "string" ? body.status.trim() : "") as UserStatus
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "ids must be a non-empty array",
    })
  }

  if (ids.length > 200) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "ids must have at most 200 items",
    })
  }

  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "status must be one of: active, inactive",
    })
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER) as any
  const userService = req.scope.resolve(Modules.USER) as any
  const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any

  let updated = 0
  const failed: Array<{ id: string; code: string; message: string }> = []

  for (const rawId of ids) {
    const composite = typeof rawId === "string" ? rawId : ""
    const parsed = parseCompositeId(composite)
    if (!parsed) {
      failed.push({
        id: composite,
        code: "INVALID_ID",
        message: "Invalid composite id",
      })
      continue
    }

    try {
      if (parsed.role === "customer") {
        const customers = (await customerService.listCustomers({ id: parsed.entityId }, { take: 1 })) as any[]
        const customer = customers?.[0]
        if (!customer) {
          failed.push({ id: composite, code: "NOT_FOUND", message: "Customer not found" })
          continue
        }

        const nextMeta = {
          ...(customer.metadata || {}),
          is_active: status === "active",
          deactivation_reason:
            status === "inactive"
              ? reason || (customer.metadata || {})?.deactivation_reason || null
              : null,
        }

        await customerService.updateCustomers(parsed.entityId, { metadata: nextMeta })
        updated += 1
        continue
      }

      if (parsed.role === "admin") {
        const admins = (await userService.listUsers({ id: parsed.entityId }, { take: 1 })) as any[]
        const admin = admins?.[0]
        if (!admin) {
          failed.push({ id: composite, code: "NOT_FOUND", message: "Admin user not found" })
          continue
        }

        const nextMeta = {
          ...(admin.metadata || {}),
          is_active: status === "active",
          deactivation_reason:
            status === "inactive"
              ? reason || (admin.metadata || {})?.deactivation_reason || null
              : null,
        }

        await userService.updateUsers({ id: parsed.entityId, metadata: nextMeta })
        updated += 1
        continue
      }

      if (parsed.role === "clinician") {
        const [clinicians] = (await consultationService.listAndCountClinicians(
          { id: parsed.entityId },
          { take: 1, withDeleted: true }
        )) as [any[], number]
        const clinician = clinicians?.[0]
        if (!clinician) {
          failed.push({ id: composite, code: "NOT_FOUND", message: "Clinician not found" })
          continue
        }

        await consultationService.updateClinicians(parsed.entityId, {
          status: status === "active" ? "active" : "inactive",
          deactivation_reason:
            status === "inactive" ? reason || clinician.deactivation_reason || null : null,
        })
        updated += 1
        continue
      }

      failed.push({ id: composite, code: "INVALID_ROLE", message: "Unsupported role" })
    } catch (error) {
      failed.push({
        id: composite,
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return res.json({
    updated,
    failed,
    status,
    inferred_active: status === "active",
  })
}

