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
  const idParam = req.params.id as string
  const parsed = parseCompositeId(decodeURIComponent(idParam))
  if (!parsed) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "id must be a composite id like: customer__{id}, admin__{id}, clinician__{id}",
    })
  }

  const body = (req.body ?? {}) as Record<string, any>
  const status = (typeof body.status === "string" ? body.status.trim() : "") as UserStatus
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""

  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "status must be one of: active, inactive",
    })
  }

  try {
    if (parsed.role === "customer") {
      const customerService = req.scope.resolve(Modules.CUSTOMER) as any
      const customers = (await customerService.listCustomers({ id: parsed.entityId }, { take: 1 })) as any[]
      const customer = customers?.[0]
      if (!customer) {
        return res.status(404).json({ code: "NOT_FOUND", message: "User not found" })
      }

      const nextMeta = {
        ...(customer.metadata || {}),
        is_active: status === "active",
        deactivation_reason: status === "inactive" ? reason || (customer.metadata || {})?.deactivation_reason || null : null,
      }

      const updated = await customerService.updateCustomers(parsed.entityId, {
        metadata: nextMeta,
      })

      return res.json({
        user: {
          id: `customer__${updated.id}`,
          entity_id: updated.id,
          role: "customer",
          status: inferStatusFromMetadata(updated.metadata),
          deactivation_reason: updated.metadata?.deactivation_reason ?? null,
        },
      })
    }

    if (parsed.role === "admin") {
      const userService = req.scope.resolve(Modules.USER) as any
      const admins = (await userService.listUsers({ id: parsed.entityId }, { take: 1 })) as any[]
      const admin = admins?.[0]
      if (!admin) {
        return res.status(404).json({ code: "NOT_FOUND", message: "User not found" })
      }

      const nextMeta = {
        ...(admin.metadata || {}),
        is_active: status === "active",
        deactivation_reason: status === "inactive" ? reason || (admin.metadata || {})?.deactivation_reason || null : null,
      }

      const updated = await userService.updateUsers({
        id: parsed.entityId,
        metadata: nextMeta,
      })

      return res.json({
        user: {
          id: `admin__${updated.id}`,
          entity_id: updated.id,
          role: "admin",
          status: inferStatusFromMetadata(updated.metadata),
          deactivation_reason: updated.metadata?.deactivation_reason ?? null,
        },
      })
    }

    if (parsed.role === "clinician") {
      const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
      const [clinicians] = await consultationService.listAndCountClinicians({ id: parsed.entityId }, { take: 1, withDeleted: true })
      const clinician = clinicians?.[0]
      if (!clinician) {
        return res.status(404).json({ code: "NOT_FOUND", message: "User not found" })
      }

      const updated = await consultationService.updateClinicians(parsed.entityId, {
        status: status === "active" ? "active" : "inactive",
        deactivation_reason: status === "inactive" ? reason || clinician.deactivation_reason || null : null,
      })

      return res.json({
        user: {
          id: `clinician__${updated.id}`,
          entity_id: updated.id,
          role: "clinician",
          status: updated.status === "active" ? "active" : "inactive",
          deactivation_reason: updated.deactivation_reason ?? null,
        },
      })
    }

    return res.status(400).json({ code: "INVALID_INPUT", message: "Unsupported role" })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to update user status",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
