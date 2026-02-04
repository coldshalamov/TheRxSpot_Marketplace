import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"

type UserRole = "customer" | "admin" | "clinician"
type UserStatus = "active" | "inactive"

type NormalizedUser = {
  id: string
  entity_id: string
  role: UserRole
  status: UserStatus
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  date_of_birth: string | null
  created_at: string
  avatar_url?: string | null
  deactivation_reason?: string | null
}

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

function getMetaValue(meta: any, key: string): string | null {
  if (!meta || typeof meta !== "object") return null
  const value = (meta as any)[key]
  if (typeof value === "string" && value.trim()) return value.trim()
  return null
}

function normalizeUserFromCustomer(customer: any): NormalizedUser {
  const meta = customer.metadata || null
  return {
    id: `customer__${customer.id}`,
    entity_id: customer.id,
    role: "customer",
    status: inferStatusFromMetadata(meta),
    first_name: customer.first_name ?? null,
    last_name: customer.last_name ?? null,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
    date_of_birth: getMetaValue(meta, "date_of_birth"),
    created_at: new Date(customer.created_at).toISOString(),
    avatar_url: null,
    deactivation_reason: getMetaValue(meta, "deactivation_reason"),
  }
}

function normalizeUserFromAdmin(user: any): NormalizedUser {
  const meta = user.metadata || null
  return {
    id: `admin__${user.id}`,
    entity_id: user.id,
    role: "admin",
    status: inferStatusFromMetadata(meta),
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    email: user.email ?? null,
    phone: getMetaValue(meta, "phone"),
    date_of_birth: getMetaValue(meta, "date_of_birth"),
    created_at: new Date(user.created_at).toISOString(),
    avatar_url: user.avatar_url ?? null,
    deactivation_reason: getMetaValue(meta, "deactivation_reason"),
  }
}

function normalizeUserFromClinician(c: any): NormalizedUser {
  return {
    id: `clinician__${c.id}`,
    entity_id: c.id,
    role: "clinician",
    status: c.status === "active" ? "active" : "inactive",
    first_name: c.first_name ?? null,
    last_name: c.last_name ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    date_of_birth: c.date_of_birth ?? null,
    created_at: new Date(c.created_at).toISOString(),
    avatar_url: null,
    deactivation_reason: c.deactivation_reason ?? null,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = parseCompositeId(decodeURIComponent(req.params.id as string))
  if (!parsed) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "id must be a composite id like: customer__{id}, admin__{id}, clinician__{id}",
    })
  }

  try {
    if (parsed.role === "customer") {
      const customerService = req.scope.resolve(Modules.CUSTOMER) as any
      const customers = (await customerService.listCustomers({ id: parsed.entityId }, { take: 1 })) as any[]
      const customer = customers?.[0]
      if (!customer) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" })
      return res.json({ user: normalizeUserFromCustomer(customer) })
    }

    if (parsed.role === "admin") {
      const userService = req.scope.resolve(Modules.USER) as any
      const users = (await userService.listUsers({ id: parsed.entityId }, { take: 1 })) as any[]
      const user = users?.[0]
      if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" })
      return res.json({ user: normalizeUserFromAdmin(user) })
    }

    if (parsed.role === "clinician") {
      const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
      const [clinicians] = await consultationService.listAndCountClinicians(
        { id: parsed.entityId },
        { take: 1, withDeleted: true }
      )
      const clinician = clinicians?.[0]
      if (!clinician) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" })
      return res.json({ user: normalizeUserFromClinician(clinician) })
    }

    return res.status(400).json({ code: "INVALID_INPUT", message: "Unsupported role" })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to retrieve user",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = parseCompositeId(decodeURIComponent(req.params.id as string))
  if (!parsed) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "id must be a composite id like: customer__{id}, admin__{id}, clinician__{id}",
    })
  }

  const body = (req.body ?? {}) as Record<string, any>
  const firstName = typeof body.first_name === "string" ? body.first_name.trim() : undefined
  const lastName = typeof body.last_name === "string" ? body.last_name.trim() : undefined
  const email = typeof body.email === "string" ? body.email.trim() : undefined
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined
  const dateOfBirth = typeof body.date_of_birth === "string" ? body.date_of_birth.trim() : undefined

  try {
    if (parsed.role === "customer") {
      const customerService = req.scope.resolve(Modules.CUSTOMER) as any
      const customers = (await customerService.listCustomers({ id: parsed.entityId }, { take: 1 })) as any[]
      const customer = customers?.[0]
      if (!customer) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" })

      const nextMeta = { ...(customer.metadata || {}) }
      if (dateOfBirth !== undefined) nextMeta.date_of_birth = dateOfBirth || null

      const updated = await customerService.updateCustomers(parsed.entityId, {
        ...(firstName !== undefined ? { first_name: firstName || null } : {}),
        ...(lastName !== undefined ? { last_name: lastName || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        metadata: nextMeta,
      })

      return res.json({ user: normalizeUserFromCustomer(updated) })
    }

    if (parsed.role === "admin") {
      const userService = req.scope.resolve(Modules.USER) as any
      const users = (await userService.listUsers({ id: parsed.entityId }, { take: 1 })) as any[]
      const user = users?.[0]
      if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" })

      const nextMeta = { ...(user.metadata || {}) }
      if (phone !== undefined) nextMeta.phone = phone || null
      if (dateOfBirth !== undefined) nextMeta.date_of_birth = dateOfBirth || null

      const updated = await userService.updateUsers({
        id: parsed.entityId,
        ...(firstName !== undefined ? { first_name: firstName || null } : {}),
        ...(lastName !== undefined ? { last_name: lastName || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        metadata: nextMeta,
      })

      return res.json({ user: normalizeUserFromAdmin(updated) })
    }

    if (parsed.role === "clinician") {
      const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
      const [clinicians] = await consultationService.listAndCountClinicians(
        { id: parsed.entityId },
        { take: 1, withDeleted: true }
      )
      const clinician = clinicians?.[0]
      if (!clinician) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" })

      const updated = await consultationService.updateClinicians(parsed.entityId, {
        ...(firstName !== undefined ? { first_name: firstName || null } : {}),
        ...(lastName !== undefined ? { last_name: lastName || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(dateOfBirth !== undefined ? { date_of_birth: dateOfBirth || null } : {}),
      })

      return res.json({ user: normalizeUserFromClinician(updated) })
    }

    return res.status(400).json({ code: "INVALID_INPUT", message: "Unsupported role" })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to update user",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

