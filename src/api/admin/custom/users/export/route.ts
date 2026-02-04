import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"

type UserRole = "customer" | "admin" | "clinician"

function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date
}

function normalizeDigits(value: string): string {
  return value.replace(/[^\d]/g, "")
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim()
}

function matchesQuery(user: any, q: string): boolean {
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

function inferStatusFromMetadata(meta: any): "active" | "inactive" {
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

function csvEscape(value: any): string {
  const str = value == null ? "" : String(value)
  return `"${str.replace(/\"/g, `""`)}"`
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.query as Record<string, any>

    const role = (typeof query.role === "string" ? query.role.trim() : "") as UserRole | ""
    const status = (typeof query.status === "string" ? query.status.trim() : "") as
      | "active"
      | "inactive"
      | ""
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

    const scanTarget = 10000
    const rolesToInclude: UserRole[] = role ? [role] : ["customer", "admin", "clinician"]
    const users: any[] = []

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
        users.push({
          role: "customer",
          status: inferStatusFromMetadata(meta),
          first_name: c.first_name ?? "",
          last_name: c.last_name ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
          date_of_birth: getMetaValue(meta, "date_of_birth") ?? "",
          joined_at: new Date(c.created_at).toISOString(),
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
      const admins = (await userService.listUsers(filters, {
        take: scanTarget,
        order: { created_at: "DESC" },
      })) as any[]

      for (const u of admins || []) {
        const meta = u.metadata || null
        users.push({
          role: "admin",
          status: inferStatusFromMetadata(meta),
          first_name: u.first_name ?? "",
          last_name: u.last_name ?? "",
          email: u.email ?? "",
          phone: getMetaValue(meta, "phone") ?? "",
          date_of_birth: getMetaValue(meta, "date_of_birth") ?? "",
          joined_at: new Date(u.created_at).toISOString(),
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
        users.push({
          role: "clinician",
          status: c.status === "active" ? "active" : "inactive",
          first_name: c.first_name ?? "",
          last_name: c.last_name ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
          date_of_birth: c.date_of_birth ?? "",
          joined_at: new Date(c.created_at).toISOString(),
        })
      }
    }

    let filtered = users
    if (status) filtered = filtered.filter((u) => u.status === status)
    if (q) filtered = filtered.filter((u) => matchesQuery(u, q))
    if (dateFrom || dateTo) {
      filtered = filtered.filter((u) => {
        const t = new Date(u.joined_at).getTime()
        if (dateFrom && t < dateFrom.getTime()) return false
        if (dateTo && t > dateTo.getTime()) return false
        return true
      })
    }

    const header = ["role", "status", "first_name", "last_name", "email", "phone", "date_of_birth", "joined_at"]
    const lines = [header.join(",")]
    for (const u of filtered) {
      lines.push(
        [
          csvEscape(u.role),
          csvEscape(u.status),
          csvEscape(u.first_name),
          csvEscape(u.last_name),
          csvEscape(u.email),
          csvEscape(u.phone),
          csvEscape(u.date_of_birth),
          csvEscape(u.joined_at),
        ].join(",")
      )
    }

    const filenameParts = ["users"]
    if (role) filenameParts.push(role)
    if (status) filenameParts.push(status)
    filenameParts.push(new Date().toISOString().slice(0, 10))

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="${filenameParts.join("_")}.csv"`)

    return res.send(lines.join("\n"))
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to export users CSV",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
