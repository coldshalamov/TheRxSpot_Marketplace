import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CONSULTATION_MODULE } from "../../../../modules/consultation"

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

function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date
}

function asInt(value: any, fallback: number): number {
  if (value == null) return fallback
  const num = typeof value === "string" ? parseInt(value, 10) : Number(value)
  return Number.isFinite(num) ? Math.trunc(num) : fallback
}

function normalizeDigits(value: string): string {
  return value.replace(/[^\d]/g, "")
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim()
}

function matchesQuery(user: NormalizedUser, q: string): boolean {
  const query = normalizeText(q)
  if (!query) return true

  const tokens = query.split(/\s+/).filter(Boolean)
  const hay = normalizeText(
    [
      user.first_name || "",
      user.last_name || "",
      user.email || "",
      user.phone || "",
    ].join(" ")
  )

  const qDigits = normalizeDigits(query)
  const phoneDigits = normalizeDigits(user.phone || "")

  return tokens.every((t) => {
    const tDigits = normalizeDigits(t)
    if (tDigits.length >= 4) {
      return phoneDigits.includes(tDigits) || hay.includes(normalizeText(t))
    }
    return hay.includes(normalizeText(t))
  }) || (qDigits.length >= 4 && phoneDigits.includes(qDigits))
}

function compositeId(role: UserRole, entityId: string): string {
  return `${role}__${entityId}`
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

function sortUsers(
  users: NormalizedUser[],
  sortBy: "name" | "joined",
  sortOrder: "asc" | "desc"
): NormalizedUser[] {
  const dir = sortOrder === "asc" ? 1 : -1
  const byName = (u: NormalizedUser) =>
    normalizeText(`${u.first_name || ""} ${u.last_name || ""}`.trim() || (u.email || ""))

  return users.sort((a, b) => {
    if (sortBy === "name") {
      const an = byName(a)
      const bn = byName(b)
      if (an < bn) return -1 * dir
      if (an > bn) return 1 * dir
      return 0
    }

    const at = new Date(a.created_at).getTime()
    const bt = new Date(b.created_at).getTime()
    return (at - bt) * dir
  })
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.query as Record<string, any>

    const limit = Math.min(Math.max(asInt(query.limit, 25), 1), 100)
    const offset = Math.max(asInt(query.offset, 0), 0)

    const role = (typeof query.role === "string" ? query.role.trim() : "") as UserRole | ""
    const status = (typeof query.status === "string" ? query.status.trim() : "") as UserStatus | ""
    const q = typeof query.q === "string" ? query.q.trim() : ""

    if (role && !["customer", "admin", "clinician"].includes(role)) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "role must be one of: customer, admin, clinician",
      })
    }

    if (status && !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "status must be one of: active, inactive",
      })
    }

    const dateFrom = parseIsoDate(typeof query.date_from === "string" ? query.date_from : undefined)
    const dateTo = parseIsoDate(typeof query.date_to === "string" ? query.date_to : undefined)
    if (query.date_from && !dateFrom) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "date_from must be a valid ISO date string",
      })
    }
    if (query.date_to && !dateTo) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "date_to must be a valid ISO date string",
      })
    }

    const sortBy = (typeof query.sort_by === "string" ? query.sort_by : "joined") as
      | "name"
      | "joined"
    const sortOrder = (typeof query.sort_order === "string" ? query.sort_order : "desc") as
      | "asc"
      | "desc"

    const scanTarget = q || status || dateFrom || dateTo ? 5000 : Math.max(offset + limit, 200)

    const rolesToInclude: UserRole[] = role ? [role] : ["customer", "admin", "clinician"]

    const users: NormalizedUser[] = []

    if (rolesToInclude.includes("customer")) {
      const customerService = req.scope.resolve(Modules.CUSTOMER) as any
      const filters: any = {}
      if (dateFrom || dateTo) {
        filters.created_at = {}
        if (dateFrom) filters.created_at.$gte = dateFrom
        if (dateTo) filters.created_at.$lte = dateTo
      }

      const customers = (await customerService.listCustomers(filters, {
        take: scanTarget,
        order: { created_at: "DESC" },
      })) as any[]

      for (const c of customers || []) {
        const meta = c.metadata || null
        const inferredStatus = inferStatusFromMetadata(meta)
        users.push({
          id: compositeId("customer", c.id),
          entity_id: c.id,
          role: "customer",
          status: inferredStatus,
          first_name: c.first_name ?? null,
          last_name: c.last_name ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          date_of_birth: getMetaValue(meta, "date_of_birth"),
          created_at: new Date(c.created_at).toISOString(),
          avatar_url: null,
          deactivation_reason: getMetaValue(meta, "deactivation_reason"),
        })
      }
    }

    if (rolesToInclude.includes("admin")) {
      const userService = req.scope.resolve(Modules.USER) as any
      const filters: any = {}
      if (dateFrom || dateTo) {
        filters.created_at = {}
        if (dateFrom) filters.created_at.$gte = dateFrom
        if (dateTo) filters.created_at.$lte = dateTo
      }

      const adminUsers = (await userService.listUsers(filters, {
        take: scanTarget,
        order: { created_at: "DESC" },
      })) as any[]

      for (const u of adminUsers || []) {
        const meta = u.metadata || null
        const inferredStatus = inferStatusFromMetadata(meta)
        users.push({
          id: compositeId("admin", u.id),
          entity_id: u.id,
          role: "admin",
          status: inferredStatus,
          first_name: u.first_name ?? null,
          last_name: u.last_name ?? null,
          email: u.email ?? null,
          phone: getMetaValue(meta, "phone"),
          date_of_birth: getMetaValue(meta, "date_of_birth"),
          created_at: new Date(u.created_at).toISOString(),
          avatar_url: u.avatar_url ?? null,
          deactivation_reason: getMetaValue(meta, "deactivation_reason"),
        })
      }
    }

    if (rolesToInclude.includes("clinician")) {
      const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
      const filters: any = {}
      if (dateFrom || dateTo) {
        filters.created_at = {}
        if (dateFrom) filters.created_at.$gte = dateFrom
        if (dateTo) filters.created_at.$lte = dateTo
      }

      const [clinicians] = (await consultationService.listClinicians(filters, {
        skip: 0,
        take: scanTarget,
        order: { created_at: "DESC" },
      })) as [any[], number]

      for (const c of clinicians || []) {
        const inferredStatus = c.status === "active" ? "active" : "inactive"
        users.push({
          id: compositeId("clinician", c.id),
          entity_id: c.id,
          role: "clinician",
          status: inferredStatus,
          first_name: c.first_name ?? null,
          last_name: c.last_name ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          date_of_birth: c.date_of_birth ?? null,
          created_at: new Date(c.created_at).toISOString(),
          avatar_url: null,
          deactivation_reason: c.deactivation_reason ?? null,
        })
      }
    }

    let filtered = users

    if (status) {
      filtered = filtered.filter((u) => u.status === status)
    }

    if (q) {
      filtered = filtered.filter((u) => matchesQuery(u, q))
    }

    // Joined between filters already applied at source where possible. Re-apply defensively.
    if (dateFrom || dateTo) {
      filtered = filtered.filter((u) => {
        const t = new Date(u.created_at).getTime()
        if (dateFrom && t < dateFrom.getTime()) return false
        if (dateTo && t > dateTo.getTime()) return false
        return true
      })
    }

    sortUsers(filtered, sortBy, sortOrder)

    const page = filtered.slice(offset, offset + limit)

    return res.json({
      users: page,
      count: filtered.length,
      limit,
      offset,
    })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to list users",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
